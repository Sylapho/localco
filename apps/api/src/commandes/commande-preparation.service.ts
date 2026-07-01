import { BadRequestException, Injectable } from '@nestjs/common'
import { PickupPointsService } from '../pickup-points/pickup-points.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCommandeDto } from './dto/create-commande.dto'

export type PreparedCommandeLine = {
  articleId: number
  quantite: number
}

export type PreparedCommandeArticle = {
  id: number
  stock: number
  prixCents: number
  nom: string
  imageUrl?: string | null
}

@Injectable()
export class CommandePreparationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pickupPointsService: PickupPointsService,
  ) {}

  async prepare(data: CreateCommandeDto) {
    await this.pickupPointsService.validatePickupSlot(
      data.lieu,
      data.dateRetrait,
    )

    const lignesAgregees = this.aggregateLines(data.lignes)
    const articleIds = lignesAgregees.map((ligne) => ligne.articleId)

    const articles = await this.prisma.article.findMany({
      where: {
        id: {
          in: articleIds,
        },
        online: true,
        archivedAt: null,
      },
    })

    if (articles.length !== articleIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs articles sont introuvables ou indisponibles',
      )
    }

    const totalTtcCents = lignesAgregees.reduce((total, ligne) => {
      const article = articles.find((item) => item.id === ligne.articleId)!

      return total + article.prixCents * ligne.quantite
    }, 0)

    return { lignesAgregees, articles, totalTtcCents }
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
