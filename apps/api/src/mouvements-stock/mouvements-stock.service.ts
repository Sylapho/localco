import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAjustementStockDto } from './dto/create-ajustement-stock.dto'
import { ReceptionMatiereDto } from './dto/reception-matiere.dto'

export type MouvementStockType =
  | 'vente'
  | 'production'
  | 'reception'
  | 'ajustement'
  | 'perte'
  | 'commande'

export type MouvementStockCible = 'article' | 'matiere_premiere'

type StockLotTarget = MouvementStockCible

type MouvementStockCreateData = {
  type: MouvementStockType
  cible: MouvementStockCible
  articleId?: number
  mpId?: number
  quantite: number
  stockAvant: number
  stockApres: number
  motif?: string
  reference?: string
  createdByUserId?: string
}

type StockLotRecord = {
  id: number
  remainingQuantity: number
  expiresAt: Date | null
  createdAt: Date
}

type StockItem = {
  id: number
  stock: number
}

type MouvementStockTransaction = {
  article: {
    findUniqueOrThrow: (args: {
      where: { id: number }
    }) => Promise<{ id: number; stock: number }>
    update: (args: {
      where: { id: number }
      data: { stock: { decrement: number } | number }
    }) => Promise<{ id: number; stock: number }>
  }
  matierePremiere: {
    findUniqueOrThrow: (args: {
      where: { id: number }
    }) => Promise<{ id: number; stock: number }>
    update: (args: {
      where: { id: number }
      data: { stock: { decrement: number } | number }
    }) => Promise<{ id: number; stock: number }>
  }
  mouvementStock: {
    create: (args: {
      data: MouvementStockCreateData
      include?: {
        article: boolean
        mp: boolean
      }
    }) => Promise<unknown>
  }
  stockLot: {
    findMany: (args: unknown) => Promise<unknown>
    create: (args: unknown) => Promise<unknown>
    update: (args: unknown) => Promise<unknown>
  }
}

@Injectable()
export class MouvementsStockService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.mouvementStock.findMany({
      include: {
        article: true,
        mp: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  findLots() {
    return this.prisma.stockLot.findMany({
      where: {
        remainingQuantity: {
          gt: 0,
        },
      },
      include: {
        article: true,
        mp: true,
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async getSellableArticleStock(articles: StockItem[]) {
    return this.getSellableStock('article', articles)
  }

  async getSellableMatiereStock(matieres: StockItem[]) {
    return this.getSellableStock('matiere_premiere', matieres)
  }

  async markLotAsLoss(id: number, createdByUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const lot = await tx.stockLot.findUniqueOrThrow({
        where: { id },
        include: {
          article: true,
          mp: true,
        },
      })

      if (!this.isExpired(lot.expiresAt)) {
        throw new BadRequestException(
          'Seul un lot périmé peut être passé en perte',
        )
      }

      if (lot.remainingQuantity <= 0) {
        throw new BadRequestException('Ce lot ne contient plus de stock')
      }

      if (lot.target === 'article') {
        if (!lot.article || !lot.articleId) {
          throw new BadRequestException('Lot article invalide')
        }

        const quantity = Math.min(lot.remainingQuantity, lot.article.stock)
        const updatedArticle = await tx.article.update({
          where: { id: lot.articleId },
          data: {
            stock: {
              decrement: quantity,
            },
          },
        })

        await tx.stockLot.update({
          where: { id },
          data: {
            remainingQuantity: 0,
          },
        })

        return tx.mouvementStock.create({
          data: {
            type: 'perte',
            cible: 'article',
            articleId: lot.articleId,
            quantite: -quantity,
            stockAvant: lot.article.stock,
            stockApres: updatedArticle.stock,
            motif: `Lot périmé #${id}`,
            reference: `stock-lot:${id}:perte`,
            createdByUserId,
          },
          include: {
            article: true,
            mp: true,
          },
        })
      }

      if (!lot.mp || !lot.mpId) {
        throw new BadRequestException('Lot matière première invalide')
      }

      const quantity = Math.min(lot.remainingQuantity, lot.mp.stock)
      const updatedMatiere = await tx.matierePremiere.update({
        where: { id: lot.mpId },
        data: {
          stock: {
            decrement: quantity,
          },
        },
      })

      await tx.stockLot.update({
        where: { id },
        data: {
          remainingQuantity: 0,
        },
      })

      return tx.mouvementStock.create({
        data: {
          type: 'perte',
          cible: 'matiere_premiere',
          mpId: lot.mpId,
          quantite: -quantity,
          stockAvant: lot.mp.stock,
          stockApres: updatedMatiere.stock,
          motif: `Lot périmé #${id}`,
          reference: `stock-lot:${id}:perte`,
          createdByUserId,
        },
        include: {
          article: true,
          mp: true,
        },
      })
    })
  }

  async createAjustement(
    data: CreateAjustementStockDto,
    createdByUserId?: string,
  ) {
    if (data.quantite === 0) {
      throw new BadRequestException('La quantité doit être différente de 0')
    }

    if (data.cible === 'article') {
      return this.ajusterArticle({
        articleId: data.cibleId,
        quantite: data.quantite,
        type: 'ajustement',
        motif: data.motif,
        expiresAt: this.parseOptionalDate(data.expiresAt),
        createdByUserId,
      })
    }

    return this.ajusterMatierePremiere({
      mpId: data.cibleId,
      quantite: data.quantite,
      type: 'ajustement',
      motif: data.motif,
      expiresAt: this.parseOptionalDate(data.expiresAt),
      createdByUserId,
    })
  }

  createReceptionMatiere(
    mpId: number,
    data: ReceptionMatiereDto,
    createdByUserId?: string,
  ) {
    return this.ajusterMatierePremiere({
      mpId,
      quantite: data.quantite,
      type: 'reception',
      motif: data.motif,
      reference: `matiere-premiere:${mpId}`,
      expiresAt: this.parseOptionalDate(data.expiresAt),
      createdByUserId,
    })
  }

  async recordArticleMovement(
    tx: MouvementStockTransaction,
    data: {
      articleId: number
      quantite: number
      stockAvant: number
      stockApres: number
      type: MouvementStockType
      motif?: string
      reference?: string
      expiresAt?: Date
      createdByUserId?: string
    },
  ) {
    await this.applyLotMovement(tx, {
      target: 'article',
      targetId: data.articleId,
      quantity: data.quantite,
      expiresAt: data.expiresAt,
      reference: data.reference,
    })

    return tx.mouvementStock.create({
      data: {
        type: data.type,
        cible: 'article',
        articleId: data.articleId,
        quantite: data.quantite,
        stockAvant: data.stockAvant,
        stockApres: data.stockApres,
        motif: data.motif,
        reference: data.reference,
        createdByUserId: data.createdByUserId,
      },
    })
  }

  async recordMatierePremiereMovement(
    tx: MouvementStockTransaction,
    data: {
      mpId: number
      quantite: number
      stockAvant: number
      stockApres: number
      type: MouvementStockType
      motif?: string
      reference?: string
      expiresAt?: Date
      createdByUserId?: string
    },
  ) {
    await this.applyLotMovement(tx, {
      target: 'matiere_premiere',
      targetId: data.mpId,
      quantity: data.quantite,
      expiresAt: data.expiresAt,
      reference: data.reference,
    })

    return tx.mouvementStock.create({
      data: {
        type: data.type,
        cible: 'matiere_premiere',
        mpId: data.mpId,
        quantite: data.quantite,
        stockAvant: data.stockAvant,
        stockApres: data.stockApres,
        motif: data.motif,
        reference: data.reference,
        createdByUserId: data.createdByUserId,
      },
    })
  }

  private async ajusterArticle(data: {
    articleId: number
    quantite: number
    type: MouvementStockType
    motif?: string
    reference?: string
    expiresAt?: Date
    createdByUserId?: string
  }) {
    if (!Number.isInteger(data.quantite)) {
      throw new BadRequestException(
        'La quantité doit être un entier pour un article',
      )
    }

    return this.prisma.$transaction(async (tx) => {
      const article = await tx.article.findUniqueOrThrow({
        where: { id: data.articleId },
      })
      const stockAvant = article.stock
      const stockApres = stockAvant + data.quantite

      if (stockApres < 0) {
        throw new BadRequestException(
          'Le stock article ne peut pas être négatif',
        )
      }

      await tx.article.update({
        where: { id: data.articleId },
        data: {
          stock: stockApres,
        },
      })

      await this.applyLotMovement(tx, {
        target: 'article',
        targetId: data.articleId,
        quantity: data.quantite,
        expiresAt: data.expiresAt,
        reference: data.reference,
      })

      return tx.mouvementStock.create({
        data: {
          type: data.type,
          cible: 'article',
          articleId: data.articleId,
          quantite: data.quantite,
          stockAvant,
          stockApres,
          motif: data.motif,
          reference: data.reference,
          createdByUserId: data.createdByUserId,
        },
        include: {
          article: true,
          mp: true,
        },
      })
    })
  }

  private async ajusterMatierePremiere(data: {
    mpId: number
    quantite: number
    type: MouvementStockType
    motif?: string
    reference?: string
    expiresAt?: Date
    createdByUserId?: string
  }) {
    return this.prisma.$transaction(async (tx) => {
      const matiere = await tx.matierePremiere.findUniqueOrThrow({
        where: { id: data.mpId },
      })
      const stockAvant = matiere.stock
      const stockApres = stockAvant + data.quantite

      if (stockApres < 0) {
        throw new BadRequestException(
          'Le stock matière première ne peut pas être négatif',
        )
      }

      await tx.matierePremiere.update({
        where: { id: data.mpId },
        data: {
          stock: stockApres,
        },
      })

      await this.applyLotMovement(tx, {
        target: 'matiere_premiere',
        targetId: data.mpId,
        quantity: data.quantite,
        expiresAt: data.expiresAt,
        reference: data.reference,
      })

      return tx.mouvementStock.create({
        data: {
          type: data.type,
          cible: 'matiere_premiere',
          mpId: data.mpId,
          quantite: data.quantite,
          stockAvant,
          stockApres,
          motif: data.motif,
          reference: data.reference,
          createdByUserId: data.createdByUserId,
        },
        include: {
          article: true,
          mp: true,
        },
      })
    })
  }

  private async applyLotMovement(
    tx: MouvementStockTransaction,
    data: {
      target: StockLotTarget
      targetId: number
      quantity: number
      expiresAt?: Date
      reference?: string
    },
  ) {
    if (data.quantity > 0) {
      if (!data.expiresAt) return

      await tx.stockLot.create({
        data: {
          target: data.target,
          articleId: data.target === 'article' ? data.targetId : undefined,
          mpId: data.target === 'matiere_premiere' ? data.targetId : undefined,
          initialQuantity: data.quantity,
          remainingQuantity: data.quantity,
          expiresAt: data.expiresAt,
          reference: data.reference,
        },
      })
      return
    }

    if (data.quantity < 0) {
      await this.consumeLots(
        tx,
        data.target,
        data.targetId,
        Math.abs(data.quantity),
      )
    }
  }

  private async consumeLots(
    tx: MouvementStockTransaction,
    target: StockLotTarget,
    targetId: number,
    quantity: number,
  ) {
    let remainingToConsume = quantity
    const lots = (await tx.stockLot.findMany({
      where: {
        target,
        articleId: target === 'article' ? targetId : undefined,
        mpId: target === 'matiere_premiere' ? targetId : undefined,
        remainingQuantity: {
          gt: 0,
        },
      },
      select: {
        id: true,
        remainingQuantity: true,
        expiresAt: true,
        createdAt: true,
      },
    })) as StockLotRecord[]

    const sortedLots = lots.sort((a, b) => {
      if (this.isExpired(a.expiresAt) && this.isExpired(b.expiresAt)) {
        return a.createdAt.getTime() - b.createdAt.getTime()
      }

      if (this.isExpired(a.expiresAt)) return 1
      if (this.isExpired(b.expiresAt)) return -1

      if (a.expiresAt && b.expiresAt) {
        return a.expiresAt.getTime() - b.expiresAt.getTime()
      }

      if (a.expiresAt) return -1
      if (b.expiresAt) return 1

      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    for (const lot of sortedLots) {
      if (remainingToConsume <= 0) return
      if (this.isExpired(lot.expiresAt)) continue

      const consumed = Math.min(lot.remainingQuantity, remainingToConsume)

      await tx.stockLot.update({
        where: { id: lot.id },
        data: {
          remainingQuantity: lot.remainingQuantity - consumed,
        },
      })

      remainingToConsume -= consumed
    }
  }

  private parseOptionalDate(value?: string) {
    if (!value) return undefined

    return new Date(value)
  }

  private async getSellableStock(target: StockLotTarget, items: StockItem[]) {
    const result = new Map(items.map((item) => [item.id, item.stock]))
    const ids = items.map((item) => item.id)

    if (ids.length === 0) {
      return result
    }

    const expiredLots = await this.prisma.stockLot.findMany({
      where: {
        target,
        articleId: target === 'article' ? { in: ids } : undefined,
        mpId: target === 'matiere_premiere' ? { in: ids } : undefined,
        remainingQuantity: {
          gt: 0,
        },
        expiresAt: {
          lt: this.startOfToday(),
        },
      },
      select: {
        id: true,
        articleId: true,
        mpId: true,
        remainingQuantity: true,
      },
    })

    for (const lot of expiredLots) {
      const itemId = target === 'article' ? lot.articleId : lot.mpId

      if (!itemId) continue

      result.set(
        itemId,
        Math.max(0, (result.get(itemId) ?? 0) - lot.remainingQuantity),
      )
    }

    return result
  }

  private isExpired(expiresAt: Date | null) {
    return Boolean(expiresAt && expiresAt < this.startOfToday())
  }

  private startOfToday() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return today
  }
}
