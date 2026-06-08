import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { CreateArticleDto } from './dto/create-article.dto'
import { ProduceArticleDto } from './dto/produce-article.dto'
import { UpdateArticleDto } from './dto/update-article.dto'

@Injectable()
export class ArticlesService {
  constructor(
    private prisma: PrismaService,
    private readonly mouvementsStockService: MouvementsStockService,
  ) {}

  findAll() {
    return this.prisma.article.findMany({
      include: {
        nomen: {
          include: { mp: true },
        },
      },
      orderBy: { nom: 'asc' },
    })
  }

  findOne(id: number) {
    return this.prisma.article.findUniqueOrThrow({
      where: { id },
      include: {
        nomen: {
          include: { mp: true },
        },
      },
    })
  }

  create(data: CreateArticleDto) {
    return this.prisma.article.create({
      data: {
        nom: data.nom,
        prixCents: data.prixCents,
        tvaBps: data.tvaBps ?? 550,
        stock: data.stock ?? 0,
        online: data.online ?? true,
        description: data.description,
        ingredients: data.ingredients,
        allergenes: data.allergenes,
        imageUrl: data.imageUrl,
      },
    })
  }

  update(id: number, data: UpdateArticleDto) {
    return this.prisma.article.update({
      where: { id },
      data,
    })
  }

  remove(id: number) {
    return this.prisma.article.delete({
      where: { id },
    })
  }

  async getProductionCapacity(id: number) {
    const article = await this.prisma.article.findUniqueOrThrow({
      where: { id },
      include: {
        nomen: {
          include: {
            mp: true,
          },
        },
      },
    })

    if (article.nomen.length === 0) {
      return {
        articleId: article.id,
        articleNom: article.nom,
        capacite: 0,
        limitingIngredient: null,
        ingredients: [],
      }
    }

    const sellableStockByMatiere =
      await this.mouvementsStockService.getSellableMatiereStock(
        article.nomen.map((line) => line.mp),
      )

    const ingredients = article.nomen.map((line) => {
      const sellableStock = sellableStockByMatiere.get(line.mp.id) ?? 0
      const possible = Math.floor(sellableStock / line.quantite)

      return {
        mpId: line.mp.id,
        nom: line.mp.nom,
        stock: line.mp.stock,
        sellableStock,
        unite: line.mp.unite,
        quantiteNecessaire: line.quantite,
        possible,
      }
    })

    const limitingIngredient = ingredients.reduce((min, current) => {
      return current.possible < min.possible ? current : min
    })

    return {
      articleId: article.id,
      articleNom: article.nom,
      capacite: limitingIngredient.possible,
      limitingIngredient,
      ingredients,
    }
  }

  async produce(id: number, data: ProduceArticleDto) {
    const quantite = data.quantite
    const expiresAt = data.expiresAt ? new Date(data.expiresAt) : undefined
    const article = await this.prisma.article.findUniqueOrThrow({
      where: { id },
      include: {
        nomen: {
          include: {
            mp: true,
          },
        },
      },
    })

    if (article.nomen.length === 0) {
      throw new BadRequestException(
        'Impossible de produire un article sans nomenclature',
      )
    }

    const sellableStockByMatiere =
      await this.mouvementsStockService.getSellableMatiereStock(
        article.nomen.map((line) => line.mp),
      )

    const insufficientIngredients = article.nomen
      .map((line) => {
        const needed = line.quantite * quantite
        const available = sellableStockByMatiere.get(line.mp.id) ?? 0

        return {
          mpId: line.mp.id,
          nom: line.mp.nom,
          unite: line.mp.unite,
          stock: line.mp.stock,
          needed,
          available,
          missing: Math.max(0, needed - available),
        }
      })
      .filter((item) => item.missing > 0)

    if (insufficientIngredients.length > 0) {
      throw new BadRequestException({
        message: 'Stock insuffisant pour produire cet article',
        insufficientIngredients,
      })
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of article.nomen) {
        const quantiteConsommee = line.quantite * quantite

        await tx.matierePremiere.update({
          where: { id: line.mpId },
          data: {
            stock: {
              decrement: quantiteConsommee,
            },
          },
        })

        await this.mouvementsStockService.recordMatierePremiereMovement(tx, {
          mpId: line.mpId,
          quantite: -quantiteConsommee,
          stockAvant: line.mp.stock,
          stockApres: line.mp.stock - quantiteConsommee,
          type: 'production',
          motif: `Production de ${quantite} ${article.nom}`,
          reference: `production:article:${id}`,
        })
      }

      const updatedArticle = await tx.article.update({
        where: { id },
        data: {
          stock: {
            increment: quantite,
          },
        },
        include: {
          nomen: {
            include: {
              mp: true,
            },
          },
        },
      })

      const articleMovement: Parameters<
        MouvementsStockService['recordArticleMovement']
      >[1] = {
        articleId: id,
        quantite,
        stockAvant: article.stock,
        stockApres: article.stock + quantite,
        type: 'production',
        motif: `Production de ${quantite} ${article.nom}`,
        reference: `production:article:${id}`,
      }

      if (expiresAt) {
        articleMovement.expiresAt = expiresAt
      }

      await this.mouvementsStockService.recordArticleMovement(
        tx,
        articleMovement,
      )

      return {
        article: updatedArticle,
        produced: quantite,
        consumed: article.nomen.map((line) => ({
          mpId: line.mp.id,
          nom: line.mp.nom,
          unite: line.mp.unite,
          quantite: line.quantite * quantite,
        })),
      }
    })
  }
}
