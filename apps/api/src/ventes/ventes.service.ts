import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { CreateVenteDto } from './dto/create-vente.dto'
import { calculateHtFromTtcCents } from '../money'

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
    if (!data.lignes || data.lignes.length === 0) {
      throw new BadRequestException(
        'Une vente doit contenir au moins une ligne',
      )
    }

    const articleIds = data.lignes.map((ligne) => ligne.articleId)

    const articles = await this.prisma.article.findMany({
      where: {
        id: {
          in: articleIds,
        },
      },
    })

    if (articles.length !== articleIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs articles sont introuvables',
      )
    }

    const sellableStockByArticle =
      await this.mouvementsStockService.getSellableArticleStock(articles)
    const requestedByArticle = data.lignes.reduce((acc, ligne) => {
      acc.set(ligne.articleId, (acc.get(ligne.articleId) ?? 0) + ligne.quantite)
      return acc
    }, new Map<number, number>())

    const insufficientStock = Array.from(requestedByArticle.entries())
      .map(([articleId, quantite]) => {
        const article = articles.find((a) => a.id === articleId)

        if (!article) return null

        const sellableStock = sellableStockByArticle.get(article.id) ?? 0

        return {
          articleId: article.id,
          nom: article.nom,
          stock: article.stock,
          sellableStock,
          requested: quantite,
          missing: Math.max(0, quantite - sellableStock),
        }
      })
      .filter((item) => item && item.missing > 0)

    if (insufficientStock.length > 0) {
      throw new BadRequestException({
        message: 'Stock insuffisant pour une ou plusieurs lignes',
        insufficientStock,
      })
    }

    const lignesCalculees = data.lignes.map((ligne) => {
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

    return this.prisma.$transaction(async (tx) => {
      for (const ligne of data.lignes) {
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
}
