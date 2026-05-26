import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { CreateVenteDto } from './dto/create-vente.dto'

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

    const insufficientStock = data.lignes
      .map((ligne) => {
        const article = articles.find((a) => a.id === ligne.articleId)

        if (!article) return null

        return {
          articleId: article.id,
          nom: article.nom,
          stock: article.stock,
          requested: ligne.quantite,
          missing: Math.max(0, ligne.quantite - article.stock),
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

      const prixUnitTTC = article.prix
      const totalLigneTTC = prixUnitTTC * ligne.quantite
      const totalLigneHT = totalLigneTTC / (1 + article.tva)
      const tvaLigne = totalLigneTTC - totalLigneHT

      return {
        article,
        quantite: ligne.quantite,
        prixUnit: prixUnitTTC,
        totalLigneTTC,
        totalLigneHT,
        tvaLigne,
      }
    })

    const remise = data.remise ?? 0

    const totalAvantRemiseTTC = lignesCalculees.reduce(
      (total, ligne) => total + ligne.totalLigneTTC,
      0,
    )

    const totalTTC = Math.max(0, totalAvantRemiseTTC - remise)

    const totalAvantRemiseHT = lignesCalculees.reduce(
      (total, ligne) => total + ligne.totalLigneHT,
      0,
    )

    const ratio = totalAvantRemiseTTC > 0 ? totalTTC / totalAvantRemiseTTC : 1
    const totalHT = totalAvantRemiseHT * ratio
    const tva = totalTTC - totalHT

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
          remise,
          totalTTC,
          totalHT,
          tva,
          userId: data.userId,
          lignes: {
            create: lignesCalculees.map((ligne) => ({
              articleId: ligne.article.id,
              quantite: ligne.quantite,
              prixUnit: ligne.prixUnit,
              tva: ligne.article.tva,
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
