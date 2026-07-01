import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export type CommandeWithProductionLines = {
  id: number
  statut: string
  dateRetrait?: Date | null
  createdAt?: Date
  lignes: {
    id?: number
    articleId: number
    quantite: number
  }[]
}

type ProductionOpenCommande = {
  id: number
  statut: string
  dateRetrait: Date | null
  createdAt: Date
  lignes: {
    articleId: number
    quantite: number
  }[]
}

@Injectable()
export class CommandeProductionNeedsService {
  private readonly productionAllocationStatuses = [
    'paiement_en_attente',
    'paiement_a_verifier',
    'nouvelle',
    'preparee',
  ]
  private readonly visibleProductionStatuses = [
    'paiement_a_verifier',
    'nouvelle',
    'preparee',
  ]

  constructor(private readonly prisma: PrismaService) {}

  async withProductionNeeds<T extends CommandeWithProductionLines>(
    commandes: T[],
  ) {
    if (commandes.length === 0) {
      return commandes
    }

    const articleIds = Array.from(
      new Set(
        commandes.flatMap((commande) =>
          commande.lignes.map((ligne) => ligne.articleId),
        ),
      ),
    )

    if (articleIds.length === 0) {
      return this.applyProductionQuantities(commandes, new Map())
    }

    const [articles, openCommandes] = await Promise.all([
      this.prisma.article.findMany({
        where: {
          id: {
            in: articleIds,
          },
        },
        select: {
          id: true,
          stock: true,
        },
      }),
      this.prisma.commande.findMany({
        where: {
          statut: {
            in: this.productionAllocationStatuses,
          },
          lignes: {
            some: {
              articleId: {
                in: articleIds,
              },
            },
          },
        },
        select: {
          id: true,
          statut: true,
          dateRetrait: true,
          createdAt: true,
          lignes: {
            where: {
              articleId: {
                in: articleIds,
              },
            },
            select: {
              articleId: true,
              quantite: true,
            },
          },
        },
      }),
    ])

    const currentStockByArticleId = new Map(
      articles.map((article) => [article.id, article.stock]),
    )
    const productionQuantityByLine = this.allocateProductionQuantities(
      currentStockByArticleId,
      openCommandes,
    )

    return this.applyProductionQuantities(commandes, productionQuantityByLine)
  }

  private allocateProductionQuantities(
    currentStockByArticleId: Map<number, number>,
    openCommandes: ProductionOpenCommande[],
  ) {
    const openLinesByArticleId = new Map<
      number,
      {
        commandeId: number
        statut: string
        dateRetrait: Date | null
        createdAt: Date
        articleId: number
        quantite: number
      }[]
    >()

    for (const commande of openCommandes) {
      for (const ligne of commande.lignes) {
        openLinesByArticleId.set(ligne.articleId, [
          ...(openLinesByArticleId.get(ligne.articleId) ?? []),
          {
            commandeId: commande.id,
            statut: commande.statut,
            dateRetrait: commande.dateRetrait,
            createdAt: commande.createdAt,
            articleId: ligne.articleId,
            quantite: ligne.quantite,
          },
        ])
      }
    }

    const productionQuantityByLine = new Map<string, number>()

    for (const [articleId, openLines] of openLinesByArticleId.entries()) {
      const totalOpenQuantity = openLines.reduce(
        (total, ligne) => total + ligne.quantite,
        0,
      )
      let remainingAvailableStock =
        (currentStockByArticleId.get(articleId) ?? 0) + totalOpenQuantity

      const orderedLines = [...openLines].sort((a, b) => {
        const dueDateOrder = this.compareProductionDueDates(
          a.dateRetrait,
          b.dateRetrait,
        )

        if (dueDateOrder !== 0) {
          return dueDateOrder
        }

        const createdAtOrder = a.createdAt.getTime() - b.createdAt.getTime()

        if (createdAtOrder !== 0) {
          return createdAtOrder
        }

        return a.commandeId - b.commandeId
      })

      for (const ligne of orderedLines) {
        const coveredQuantity = Math.min(
          Math.max(0, remainingAvailableStock),
          ligne.quantite,
        )
        const productionQuantity = Math.max(0, ligne.quantite - coveredQuantity)

        if (
          productionQuantity > 0 &&
          this.visibleProductionStatuses.includes(ligne.statut)
        ) {
          productionQuantityByLine.set(
            this.getProductionLineKey(ligne.commandeId, ligne.articleId),
            productionQuantity,
          )
        }

        remainingAvailableStock = Math.max(
          0,
          remainingAvailableStock - ligne.quantite,
        )
      }
    }

    return productionQuantityByLine
  }

  private applyProductionQuantities<T extends CommandeWithProductionLines>(
    commandes: T[],
    productionQuantityByLine: Map<string, number>,
  ) {
    return commandes.map((commande) => ({
      ...commande,
      lignes: commande.lignes.map((ligne) => ({
        ...ligne,
        productionQuantity:
          productionQuantityByLine.get(
            this.getProductionLineKey(commande.id, ligne.articleId),
          ) ?? 0,
      })),
    }))
  }

  private compareProductionDueDates(left: Date | null, right: Date | null) {
    if (!left && !right) {
      return 0
    }

    if (!left) {
      return 1
    }

    if (!right) {
      return -1
    }

    return left.getTime() - right.getTime()
  }

  private getProductionLineKey(commandeId: number, articleId: number) {
    return `${commandeId}:${articleId}`
  }
}
