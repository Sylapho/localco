import { Injectable, Logger } from '@nestjs/common'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'

type StockMovementTransaction = Parameters<
  MouvementsStockService['recordArticleMovement']
>[0]

type ReservationTransaction = StockMovementTransaction

type ReservationLine = {
  id?: number
  articleId: number
  quantite: number
}

type ReservationArticle = {
  id: number
  stock: number
  prixCents: number
  nom: string
  imageUrl?: string | null
}

@Injectable()
export class CommandeStockReservationService {
  private readonly logger = new Logger(CommandeStockReservationService.name)

  constructor(
    private readonly mouvementsStockService: MouvementsStockService,
  ) {}

  async reserve(
    tx: ReservationTransaction,
    data: {
      commandeId: number
      lignes: ReservationLine[]
      articles: ReservationArticle[]
      motif?: string
      reference?: string
    },
  ) {
    for (const ligne of data.lignes) {
      const article = data.articles.find((item) => item.id === ligne.articleId)!

      await tx.article.update({
        where: { id: article.id },
        data: {
          stock: {
            decrement: ligne.quantite,
          },
        },
      })

      const movement = await this.mouvementsStockService.recordArticleMovement(
        tx,
        {
          articleId: article.id,
          quantite: -ligne.quantite,
          stockAvant: article.stock,
          stockApres: article.stock - ligne.quantite,
          type: 'commande',
          motif: data.motif ?? `Réservation checkout #${data.commandeId}`,
          reference:
            data.reference ?? this.getReservationReference(data.commandeId),
        },
      )

      const consumedLots = movement.consumedLots ?? []
      const physicalQuantity = consumedLots.reduce(
        (total, consumedLot) => total + consumedLot.quantity,
        0,
      )
      const preorderedQuantity = Math.max(0, ligne.quantite - physicalQuantity)

      if (!ligne.id) {
        this.logger.warn({
          message: 'Order line has no id while recording stock allocation',
          commandeId: data.commandeId,
          articleId: ligne.articleId,
        })
        continue
      }

      await tx.ligneCommande.update({
        where: { id: ligne.id },
        data: {
          quantitePrecommande: preorderedQuantity,
        },
      })

      for (const consumedLot of consumedLots) {
        await tx.commandeStockAllocation.create({
          data: {
            commandeId: data.commandeId,
            ligneCommandeId: ligne.id,
            stockLotId: consumedLot.stockLotId,
            quantity: consumedLot.quantity,
          },
        })
      }
    }
  }

  private getReservationReference(commandeId: number) {
    return `commande:${commandeId}:reservation`
  }
}
