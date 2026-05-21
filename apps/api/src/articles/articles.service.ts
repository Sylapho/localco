import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateArticleDto } from './dto/create-article.dto'
import { UpdateArticleDto } from './dto/update-article.dto'

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) { }

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
        prix: data.prix,
        tva: data.tva ?? 0.055,
        stock: data.stock ?? 0,
        online: data.online ?? true,
        emoji: data.emoji ?? '🥖',
        description: data.description,
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

    const ingredients = article.nomen.map((line) => {
      const possible = Math.floor(line.mp.stock / line.quantite)

      return {
        mpId: line.mp.id,
        nom: line.mp.nom,
        stock: line.mp.stock,
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
}