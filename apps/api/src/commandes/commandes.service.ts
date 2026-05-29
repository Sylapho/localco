import { BadRequestException, Injectable } from '@nestjs/common'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCommandeDto } from './dto/create-commande.dto'
import { CommandeStatut } from './dto/update-commande-statut.dto'

@Injectable()
export class CommandesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mouvementsStockService: MouvementsStockService,
  ) {}

  findAll() {
    return this.prisma.commande.findMany({
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  findOne(id: number) {
    return this.prisma.commande.findUniqueOrThrow({
      where: { id },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
  }

  async create(data: CreateCommandeDto) {
    const lignesAgregees = this.aggregateLines(data.lignes)
    const articleIds = lignesAgregees.map((ligne) => ligne.articleId)

    const articles = await this.prisma.article.findMany({
      where: {
        id: {
          in: articleIds,
        },
        online: true,
      },
    })

    if (articles.length !== articleIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs articles sont introuvables ou indisponibles',
      )
    }

    const insufficientStock = lignesAgregees
      .map((ligne) => {
        const article = articles.find((item) => item.id === ligne.articleId)

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

    const totalTTC = lignesAgregees.reduce((total, ligne) => {
      const article = articles.find((item) => item.id === ligne.articleId)!

      return total + article.prix * ligne.quantite
    }, 0)

    return this.prisma.$transaction(async (tx) => {
      const commande = await tx.commande.create({
        data: {
          nom: data.nom,
          email: data.email,
          tel: data.tel,
          lieu: data.lieu,
          dateRetrait: data.dateRetrait
            ? new Date(data.dateRetrait)
            : undefined,
          totalTTC,
          statut: 'nouvelle',
          lignes: {
            create: lignesAgregees.map((ligne) => {
              const article = articles.find(
                (item) => item.id === ligne.articleId,
              )!

              return {
                articleId: article.id,
                quantite: ligne.quantite,
                prixUnit: article.prix,
              }
            }),
          },
        },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      for (const ligne of lignesAgregees) {
        const article = articles.find((item) => item.id === ligne.articleId)!

        await tx.article.update({
          where: { id: article.id },
          data: {
            stock: {
              decrement: ligne.quantite,
            },
          },
        })

        await this.mouvementsStockService.recordArticleMovement(tx, {
          articleId: article.id,
          quantite: -ligne.quantite,
          stockAvant: article.stock,
          stockApres: article.stock - ligne.quantite,
          type: 'commande',
          motif: `Commande en ligne #${commande.id}`,
          reference: `commande:${commande.id}`,
        })
      }

      return commande
    })
  }

  async updateStatut(id: number, statut: CommandeStatut) {
    const commande = await this.findOne(id)

    if (commande.statut === 'annulee') {
      throw new BadRequestException('Une commande annulee ne peut plus changer')
    }

    if (commande.statut === 'traitee') {
      throw new BadRequestException('Une commande traitee ne peut plus changer')
    }

    if (statut === 'annulee') {
      return this.cancelCommande(id)
    }

    return this.prisma.commande.update({
      where: { id },
      data: { statut },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
  }

  private async cancelCommande(id: number) {
    const commande = await this.findOne(id)

    return this.prisma.$transaction(async (tx) => {
      for (const ligne of commande.lignes) {
        const article = await tx.article.update({
          where: { id: ligne.articleId },
          data: {
            stock: {
              increment: ligne.quantite,
            },
          },
        })

        await this.mouvementsStockService.recordArticleMovement(tx, {
          articleId: ligne.articleId,
          quantite: ligne.quantite,
          stockAvant: article.stock - ligne.quantite,
          stockApres: article.stock,
          type: 'commande',
          motif: `Annulation commande #${id}`,
          reference: `commande:${id}:annulation`,
        })
      }

      return tx.commande.update({
        where: { id },
        data: { statut: 'annulee' },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })
    })
  }

  private aggregateLines(lignes: CreateCommandeDto['lignes']) {
    const linesByArticle = new Map<number, number>()

    for (const ligne of lignes) {
      linesByArticle.set(
        ligne.articleId,
        (linesByArticle.get(ligne.articleId) ?? 0) + ligne.quantite,
      )
    }

    return Array.from(linesByArticle.entries()).map(
      ([articleId, quantite]) => ({
        articleId,
        quantite,
      }),
    )
  }
}
