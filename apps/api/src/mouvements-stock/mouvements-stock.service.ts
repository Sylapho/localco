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

export type MouvementStockCible = 'article' | 'matiere_premiere'

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

type MouvementStockTransaction = {
  mouvementStock: {
    create: (args: {
      data: MouvementStockCreateData
      include?: {
        article: boolean
        mp: boolean
      }
    }) => Promise<unknown>
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

  async createAjustement(
    data: CreateAjustementStockDto,
    createdByUserId?: string,
  ) {
    if (data.quantite === 0) {
      throw new BadRequestException('La quantite doit etre differente de 0')
    }

    if (data.cible === 'article') {
      return this.ajusterArticle({
        articleId: data.cibleId,
        quantite: data.quantite,
        type: 'ajustement',
        motif: data.motif,
        createdByUserId,
      })
    }

    return this.ajusterMatierePremiere({
      mpId: data.cibleId,
      quantite: data.quantite,
      type: 'ajustement',
      motif: data.motif,
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
      createdByUserId,
    })
  }

  recordArticleMovement(
    tx: MouvementStockTransaction,
    data: {
      articleId: number
      quantite: number
      stockAvant: number
      stockApres: number
      type: MouvementStockType
      motif?: string
      reference?: string
      createdByUserId?: string
    },
  ) {
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

  recordMatierePremiereMovement(
    tx: MouvementStockTransaction,
    data: {
      mpId: number
      quantite: number
      stockAvant: number
      stockApres: number
      type: MouvementStockType
      motif?: string
      reference?: string
      createdByUserId?: string
    },
  ) {
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
    createdByUserId?: string
  }) {
    if (!Number.isInteger(data.quantite)) {
      throw new BadRequestException(
        'La quantite doit etre un entier pour un article',
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
          'Le stock article ne peut pas etre negatif',
        )
      }

      await tx.article.update({
        where: { id: data.articleId },
        data: {
          stock: stockApres,
        },
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
          'Le stock matiere premiere ne peut pas etre negatif',
        )
      }

      await tx.matierePremiere.update({
        where: { id: data.mpId },
        data: {
          stock: stockApres,
        },
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
}
