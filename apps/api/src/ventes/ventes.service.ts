import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'
import { Prisma } from '../../prisma/generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { CreateVenteDto } from './dto/create-vente.dto'
import { calculateHtFromTtcCents } from '../money'

type AggregatedSaleLine = {
  articleId: number
  quantite: number
}

type LockedSaleArticle = {
  id: number
  nom: string
  prixCents: number
  tvaBps: number
  stock: number
}

@Injectable()
export class VentesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mouvementsStockService: MouvementsStockService,
  ) {}

  findAll() {
    return this.prisma.vente.findMany({
      include: {
        user: true,
        lignes: {
          include: {
            article: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })
  }

  findOne(id: number) {
    return this.prisma.vente.findUniqueOrThrow({
      where: { id },
      include: {
        user: true,
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
  }

  async create(data: CreateVenteDto) {
    const lignesAgregees = this.aggregateSaleLines(data)

    return this.prisma.$transaction(async (tx) => {
      const articles = await this.lockSaleArticles(tx, lignesAgregees)
      const articleIds = lignesAgregees.map((ligne) => ligne.articleId)

      if (articles.length !== articleIds.length) {
        throw new BadRequestException(
          'Un ou plusieurs articles sont introuvables',
        )
      }

      const sellableStockByArticle = await this.getSellableArticleStock(
        tx,
        articles,
      )

      this.assertSufficientStock(
        articles,
        lignesAgregees,
        sellableStockByArticle,
      )

      const lignesCalculees = lignesAgregees.map((ligne) => {
        const article = articles.find((a) => a.id === ligne.articleId)!

        const prixUnitTtcCents = article.prixCents
        const totalLigneTtcCents = prixUnitTtcCents * ligne.quantite
        const totalLigneHtCents = calculateHtFromTtcCents(
          totalLigneTtcCents,
          article.tvaBps,
        )
        const tvaLigneCents = totalLigneTtcCents - totalLigneHtCents

        return {
          article,
          quantite: ligne.quantite,
          prixUnitCents: prixUnitTtcCents,
          totalLigneTtcCents,
          totalLigneHtCents,
          tvaLigneCents,
        }
      })

      const remiseCents = data.remiseCents ?? 0

      const totalAvantRemiseTtcCents = lignesCalculees.reduce(
        (total, ligne) => total + ligne.totalLigneTtcCents,
        0,
      )

      const totalTtcCents = Math.max(0, totalAvantRemiseTtcCents - remiseCents)

      const totalAvantRemiseHtCents = lignesCalculees.reduce(
        (total, ligne) => total + ligne.totalLigneHtCents,
        0,
      )

      const totalHtCents =
        totalAvantRemiseTtcCents > 0
          ? Math.round(
              (totalAvantRemiseHtCents * totalTtcCents) /
                totalAvantRemiseTtcCents,
            )
          : totalAvantRemiseHtCents
      const tvaCents = totalTtcCents - totalHtCents

      for (const ligne of lignesAgregees) {
        await tx.article.update({
          where: { id: ligne.articleId },
          data: {
            stock: {
              decrement: ligne.quantite,
            },
          },
        })
      }

      const vente = await tx.vente.create({
        data: {
          mode: data.mode,
          remiseCents,
          totalTtcCents,
          totalHtCents,
          tvaCents,
          userId: data.userId,
          lignes: {
            create: lignesCalculees.map((ligne) => ({
              articleId: ligne.article.id,
              quantite: ligne.quantite,
              prixUnitCents: ligne.prixUnitCents,
              tvaBps: ligne.article.tvaBps,
            })),
          },
        },
        include: {
          user: true,
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      for (const ligne of lignesCalculees) {
        await this.mouvementsStockService.recordArticleMovement(tx, {
          articleId: ligne.article.id,
          quantite: -ligne.quantite,
          stockAvant: ligne.article.stock,
          stockApres: ligne.article.stock - ligne.quantite,
          type: 'vente',
          motif: `Vente #${vente.id}`,
          reference: `vente:${vente.id}`,
          createdByUserId:
            typeof data.userId === 'number'
              ? data.userId.toString()
              : undefined,
        })
      }

      return vente
    })
  }

  private aggregateSaleLines(data: CreateVenteDto): AggregatedSaleLine[] {
    if (!data.lignes || data.lignes.length === 0) {
      throw new BadRequestException(
        'Une vente doit contenir au moins une ligne',
      )
    }

    const requestedByArticle = data.lignes.reduce((acc, ligne) => {
      if (
        !Number.isInteger(ligne.articleId) ||
        ligne.articleId <= 0 ||
        !Number.isInteger(ligne.quantite) ||
        ligne.quantite <= 0
      ) {
        throw new BadRequestException('Ligne de vente invalide')
      }

      acc.set(ligne.articleId, (acc.get(ligne.articleId) ?? 0) + ligne.quantite)
      return acc
    }, new Map<number, number>())

    return Array.from(requestedByArticle.entries())
      .map(([articleId, quantite]) => ({
        articleId,
        quantite,
      }))
      .sort((a, b) => a.articleId - b.articleId)
  }

  private async lockSaleArticles(
    tx: { $queryRaw: Prisma.TransactionClient['$queryRaw'] },
    lignes: AggregatedSaleLine[],
  ) {
    const articleIds = lignes.map((ligne) => ligne.articleId)

    return tx.$queryRaw<LockedSaleArticle[]>`
      SELECT "id", "nom", "prixCents", "tvaBps", "stock"
      FROM "Article"
      WHERE "id" IN (${Prisma.join(articleIds)})
      ORDER BY "id" ASC
      FOR UPDATE
    `
  }

  private async getSellableArticleStock(
    tx: Pick<Prisma.TransactionClient, 'stockLot'>,
    articles: LockedSaleArticle[],
  ) {
    const result = new Map(
      articles.map((article) => [article.id, article.stock]),
    )
    const ids = articles.map((article) => article.id)

    if (ids.length === 0) {
      return result
    }

    const expiredLots = await tx.stockLot.findMany({
      where: {
        target: 'article',
        articleId: {
          in: ids,
        },
        remainingQuantity: {
          gt: 0,
        },
        expiresAt: {
          lt: this.startOfToday(),
        },
      },
      select: {
        articleId: true,
        remainingQuantity: true,
      },
    })

    for (const lot of expiredLots) {
      if (!lot.articleId) continue

      result.set(
        lot.articleId,
        Math.max(0, (result.get(lot.articleId) ?? 0) - lot.remainingQuantity),
      )
    }

    return result
  }

  private assertSufficientStock(
    articles: LockedSaleArticle[],
    lignes: AggregatedSaleLine[],
    sellableStockByArticle: Map<number, number>,
  ) {
    const insufficientStock = lignes
      .map((ligne) => {
        const article = articles.find((a) => a.id === ligne.articleId)

        if (!article) return null

        const sellableStock = sellableStockByArticle.get(article.id) ?? 0

        return {
          articleId: article.id,
          nom: article.nom,
          stock: article.stock,
          sellableStock,
          requested: ligne.quantite,
          missing: Math.max(0, ligne.quantite - sellableStock),
        }
      })
      .filter((item) => item && item.missing > 0)

    if (insufficientStock.length > 0) {
      throw new ConflictException({
        code: 'INSUFFICIENT_STOCK',
        message: 'Stock insuffisant pour une ou plusieurs lignes',
        insufficientStock,
      })
    }
  }

  private startOfToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return today
  }
}
