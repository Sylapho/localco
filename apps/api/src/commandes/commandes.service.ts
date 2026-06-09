import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Stripe from 'stripe'
import { EmailsService } from '../emails/emails.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCommandeDto } from './dto/create-commande.dto'
import { CommandeStatut } from './dto/update-commande-statut.dto'
import { validatePickupSlot } from './pickup-slots'

type StockMovementTransaction = Parameters<
  MouvementsStockService['recordArticleMovement']
>[0]

type ReservationTransaction = StockMovementTransaction & {
  mouvementStock: StockMovementTransaction['mouvementStock'] & {
    findFirst: (args: {
      where: { reference: string }
      select: { id: true }
    }) => Promise<{ id: number } | null>
  }
}

type ReservationLine = {
  articleId: number
  quantite: number
  article?: {
    stock: number
  } | null
}

type ReservationArticle = {
  id: number
  stock: number
  prixCents: number
  nom: string
  imageUrl?: string | null
}

type CommandeWithProductionLines = {
  id: number
  lignes: {
    articleId: number
    quantite: number
  }[]
}

type CommandeStockMovement = {
  articleId: number | null
  quantite: number
  stockApres: number
  reference: string | null
}

type StripeCheckoutWebhookEvent = {
  id: string
  type: string
  data: {
    object: {
      id: string
    }
  }
}

@Injectable()
export class CommandesService {
  private stripe: InstanceType<typeof Stripe> | null = null
  private readonly abandonedDelayMinutes = 60

  constructor(
    private readonly prisma: PrismaService,
    private readonly mouvementsStockService: MouvementsStockService,
    private readonly configService: ConfigService,
    private readonly emailsService: EmailsService,
  ) {}

  async findAll() {
    await this.cleanupAbandonedCommandes()

    const commandes = await this.prisma.commande.findMany({
      where: {
        statut: {
          not: 'paiement_en_attente',
        },
      },
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

    return this.withProductionNeeds(commandes)
  }

  async findOne(id: number) {
    await this.cleanupAbandonedCommandes()

    const commande = await this.prisma.commande.findUniqueOrThrow({
      where: { id },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
        historique: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    const [commandeWithProductionNeeds] = await this.withProductionNeeds([
      commande,
    ])

    return commandeWithProductionNeeds
  }

  async findPublicCheckoutSummary(sessionId: string) {
    const normalizedSessionId = sessionId.trim()

    if (!normalizedSessionId) {
      throw new BadRequestException('Session de paiement invalide')
    }

    const commande = await this.prisma.commande.findFirst({
      where: { stripeId: normalizedSessionId },
      select: {
        id: true,
        totalTtcCents: true,
        lieu: true,
        dateRetrait: true,
        statut: true,
        createdAt: true,
        lignes: {
          select: {
            quantite: true,
            prixUnitCents: true,
            article: {
              select: {
                nom: true,
              },
            },
          },
        },
      },
    })

    if (!commande) {
      throw new NotFoundException('Commande introuvable')
    }

    return {
      id: commande.id,
      reference: this.formatCommandeReference(commande.id),
      totalTtcCents: commande.totalTtcCents,
      lieu: commande.lieu,
      dateRetrait: commande.dateRetrait?.toISOString() ?? null,
      statut: commande.statut,
      paiementStatut: this.getPublicPaymentStatus(commande.statut),
      createdAt: commande.createdAt.toISOString(),
      lignes: commande.lignes.map((ligne) => ({
        nom: ligne.article.nom,
        quantite: ligne.quantite,
        prixUnitCents: ligne.prixUnitCents,
        totalCents: ligne.prixUnitCents * ligne.quantite,
      })),
    }
  }

  async create(data: CreateCommandeDto) {
    const { lignesAgregees, articles, totalTtcCents } =
      await this.prepareCommande(data)

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
          totalTtcCents,
          statut: 'nouvelle',
          lignes: {
            create: lignesAgregees.map((ligne) => {
              const article = articles.find(
                (item) => item.id === ligne.articleId,
              )!

              return {
                articleId: article.id,
                quantite: ligne.quantite,
                prixUnitCents: article.prixCents,
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

      await this.recordStatusHistory(tx, {
        commandeId: commande.id,
        ancienStatut: null,
        nouveauStatut: 'nouvelle',
        motif: 'creation_directe',
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

  async createCheckout(data: CreateCommandeDto) {
    const stripe = this.getStripe()
    const shopUrl =
      this.configService.get<string>('SHOP_PUBLIC_URL') ??
      'http://localhost:3001'
    const { lignesAgregees, articles, totalTtcCents } =
      await this.prepareCommande(data)

    const commande = await this.prisma.$transaction(async (tx) => {
      const created = await tx.commande.create({
        data: {
          nom: data.nom,
          email: data.email,
          tel: data.tel,
          lieu: data.lieu,
          dateRetrait: data.dateRetrait
            ? new Date(data.dateRetrait)
            : undefined,
          totalTtcCents,
          statut: 'paiement_en_attente',
          lignes: {
            create: lignesAgregees.map((ligne) => {
              const article = articles.find(
                (item) => item.id === ligne.articleId,
              )!

              return {
                articleId: article.id,
                quantite: ligne.quantite,
                prixUnitCents: article.prixCents,
              }
            }),
          },
        },
      })

      await this.recordStatusHistory(tx, {
        commandeId: created.id,
        ancienStatut: null,
        nouveauStatut: 'paiement_en_attente',
        motif: 'checkout_cree',
      })

      await this.reserveCommandeStock(tx, {
        commandeId: created.id,
        lignes: lignesAgregees,
        articles,
      })

      return created
    })

    let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>

    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          customer_email: data.email,
          client_reference_id: String(commande.id),
          line_items: lignesAgregees.map((ligne) => {
            const article = articles.find(
              (item) => item.id === ligne.articleId,
            )!
            const images =
              article.imageUrl && article.imageUrl.startsWith('http')
                ? [article.imageUrl]
                : undefined

            return {
              quantity: ligne.quantite,
              price_data: {
                currency: 'eur',
                unit_amount: article.prixCents,
                product_data: {
                  name: article.nom,
                  images,
                },
              },
            }
          }),
          metadata: {
            commandeId: String(commande.id),
          },
          success_url: `${shopUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${shopUrl}/cancel`,
        },
        {
          idempotencyKey: `commande:${commande.id}:checkout`,
        },
      )
    } catch (error) {
      await this.cancelCheckoutBeforePayment(
        commande.id,
        'checkout_stripe_creation_echec',
      )

      throw new BadRequestException(
        'Le paiement est temporairement indisponible',
        {
          cause: error,
        },
      )
    }

    if (!session.url) {
      await this.cancelCheckoutBeforePayment(
        commande.id,
        'checkout_session_sans_url',
      )

      throw new BadRequestException(
        'Impossible de créer la session de paiement',
      )
    }

    try {
      await this.prisma.commande.update({
        where: { id: commande.id },
        data: { stripeId: session.id },
      })
    } catch (error) {
      await this.cancelCheckoutBeforePayment(
        commande.id,
        'checkout_stripe_id_update_echec',
      )

      throw new BadRequestException(
        'Le paiement est temporairement indisponible',
        {
          cause: error,
        },
      )
    }

    return { url: session.url }
  }

  async handleStripeWebhook(
    rawBody: Buffer | undefined,
    signature: string | string[] | undefined,
  ) {
    const stripe = this.getStripe()
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    )
    const stripeSignature = Array.isArray(signature) ? signature[0] : signature

    if (!webhookSecret || !stripeSignature || !rawBody) {
      throw new BadRequestException('Webhook Stripe invalide')
    }

    let event: StripeCheckoutWebhookEvent

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        stripeSignature,
        webhookSecret,
      ) as StripeCheckoutWebhookEvent
    } catch (error) {
      throw new BadRequestException('Webhook Stripe invalide', {
        cause: error,
      })
    }

    const isFreshEvent = await this.registerStripeWebhookEvent(event)

    if (!isFreshEvent) {
      return { received: true, duplicate: true }
    }

    if (event.type === 'checkout.session.completed') {
      const confirmedOrder = await this.confirmPaidCommande(
        event.data.object.id,
      )

      if (confirmedOrder) {
        await this.emailsService.sendOrderConfirmation(confirmedOrder)
      }
    }

    if (event.type === 'checkout.session.expired') {
      await this.expirePendingCommande(event.data.object.id)
    }

    return { received: true }
  }

  async updateStatut(id: number, statut: CommandeStatut) {
    const commande = await this.findOne(id)

    if (commande.statut === 'annulee') {
      throw new BadRequestException('Une commande annulée ne peut plus changer')
    }

    if (commande.statut === 'traitee') {
      throw new BadRequestException('Une commande traitée ne peut plus changer')
    }

    if (commande.statut === 'paiement_en_attente' && statut !== 'annulee') {
      throw new BadRequestException(
        'Le paiement de cette commande est en attente',
      )
    }

    if (commande.statut === 'paiement_a_verifier' && statut !== 'annulee') {
      throw new BadRequestException(
        'Le stock de cette commande doit être vérifié',
      )
    }

    if (statut === 'annulee') {
      return this.cancelCommande(id)
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.commande.update({
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

      await this.recordStatusHistory(tx, {
        commandeId: id,
        ancienStatut: commande.statut,
        nouveauStatut: statut,
        motif: 'statut_modifie',
      })

      return updated
    })
  }

  async cleanupAbandonedCommandes() {
    const cutoff = new Date(Date.now() - this.abandonedDelayMinutes * 60 * 1000)

    const commandes = await this.prisma.commande.findMany({
      where: {
        statut: 'paiement_en_attente',
        createdAt: {
          lt: cutoff,
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

    if (commandes.length === 0) {
      return { count: 0 }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const commande of commandes) {
        await this.releaseReservedStock(tx, commande)

        await tx.commande.update({
          where: { id: commande.id },
          data: { statut: 'annulee' },
        })

        await this.recordStatusHistory(tx, {
          commandeId: commande.id,
          ancienStatut: commande.statut,
          nouveauStatut: 'annulee',
          motif: 'commande_abandonnee',
        })
      }
    })

    return { count: commandes.length }
  }

  private async cancelCommande(id: number) {
    const commande = await this.findOne(id)

    if (
      commande.statut === 'paiement_en_attente' ||
      commande.statut === 'paiement_a_verifier'
    ) {
      return this.prisma.$transaction(async (tx) => {
        await this.releaseReservedStock(tx, commande)

        const updated = await tx.commande.update({
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

        await this.recordStatusHistory(tx, {
          commandeId: id,
          ancienStatut: commande.statut,
          nouveauStatut: 'annulee',
          motif: 'annulation',
        })

        return updated
      })
    }

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

      const updated = await tx.commande.update({
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

      await this.recordStatusHistory(tx, {
        commandeId: id,
        ancienStatut: commande.statut,
        nouveauStatut: 'annulee',
        motif: 'annulation',
      })

      return updated
    })
  }

  private async confirmPaidCommande(stripeId: string) {
    const commande = await this.prisma.commande.findFirst({
      where: { stripeId },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    if (!commande || commande.statut !== 'paiement_en_attente') {
      return
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.commande.update({
        where: { id: commande.id },
        data: { statut: 'nouvelle' },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      await this.recordStatusHistory(tx, {
        commandeId: commande.id,
        ancienStatut: commande.statut,
        nouveauStatut: 'nouvelle',
        motif: 'paiement_confirme',
      })

      return updated
    })
  }

  private async expirePendingCommande(stripeId: string) {
    const commandes = await this.prisma.commande.findMany({
      where: {
        stripeId,
        statut: 'paiement_en_attente',
      },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    await this.prisma.$transaction(async (tx) => {
      for (const commande of commandes) {
        await this.releaseReservedStock(tx, commande)

        await tx.commande.update({
          where: { id: commande.id },
          data: { statut: 'annulee' },
        })

        await this.recordStatusHistory(tx, {
          commandeId: commande.id,
          ancienStatut: commande.statut,
          nouveauStatut: 'annulee',
          motif: 'checkout_expire',
        })
      }
    })
  }

  private async cancelCheckoutBeforePayment(commandeId: number, motif: string) {
    await this.prisma.$transaction(async (tx) => {
      const commande = await tx.commande.findUniqueOrThrow({
        where: { id: commandeId },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      await this.releaseReservedStock(tx, commande)

      await tx.commande.update({
        where: { id: commandeId },
        data: { statut: 'annulee' },
      })

      await this.recordStatusHistory(tx, {
        commandeId,
        ancienStatut: commande.statut,
        nouveauStatut: 'annulee',
        motif,
      })
    })
  }

  private async registerStripeWebhookEvent(event: StripeCheckoutWebhookEvent) {
    try {
      await this.prisma.stripeWebhookEvent.create({
        data: {
          eventId: event.id,
          type: event.type,
        },
      })

      return true
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return false
      }

      throw error
    }
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    )
  }

  private async reserveCommandeStock(
    tx: ReservationTransaction,
    data: {
      commandeId: number
      lignes: ReservationLine[]
      articles: ReservationArticle[]
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

      await this.mouvementsStockService.recordArticleMovement(tx, {
        articleId: article.id,
        quantite: -ligne.quantite,
        stockAvant: article.stock,
        stockApres: article.stock - ligne.quantite,
        type: 'commande',
        motif: `Réservation checkout #${data.commandeId}`,
        reference: this.getReservationReference(data.commandeId),
      })
    }
  }

  private async releaseReservedStock(
    tx: ReservationTransaction,
    commande: {
      id: number
      lignes: ReservationLine[]
    },
  ) {
    const reservation = await tx.mouvementStock.findFirst({
      where: { reference: this.getReservationReference(commande.id) },
      select: { id: true },
    })
    const release = await tx.mouvementStock.findFirst({
      where: { reference: this.getReservationReleaseReference(commande.id) },
      select: { id: true },
    })

    if (!reservation || release) {
      return
    }

    for (const ligne of commande.lignes) {
      const stockAvant = ligne.article?.stock ?? 0
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
        stockAvant,
        stockApres: article.stock,
        type: 'commande',
        motif: `Libération réservation commande #${commande.id}`,
        reference: this.getReservationReleaseReference(commande.id),
      })
    }
  }

  private getReservationReference(commandeId: number) {
    return `commande:${commandeId}:reservation`
  }

  private getReservationReleaseReference(commandeId: number) {
    return `commande:${commandeId}:reservation:release`
  }

  private getDirectOrderReference(commandeId: number) {
    return `commande:${commandeId}`
  }

  private async withProductionNeeds<T extends CommandeWithProductionLines>(
    commandes: T[],
  ) {
    if (commandes.length === 0) {
      return commandes
    }

    const referenceToCommandeId = new Map<string, number>()

    for (const commande of commandes) {
      referenceToCommandeId.set(
        this.getDirectOrderReference(commande.id),
        commande.id,
      )
      referenceToCommandeId.set(
        this.getReservationReference(commande.id),
        commande.id,
      )
    }

    const movements = (await this.prisma.mouvementStock.findMany({
      where: {
        reference: {
          in: Array.from(referenceToCommandeId.keys()),
        },
        articleId: {
          not: null,
        },
        quantite: {
          lt: 0,
        },
      },
      select: {
        articleId: true,
        quantite: true,
        stockApres: true,
        reference: true,
      },
    })) as CommandeStockMovement[]

    const productionQuantityByLine = new Map<string, number>()

    for (const movement of movements) {
      if (!movement.reference || !movement.articleId) {
        continue
      }

      const commandeId = referenceToCommandeId.get(movement.reference)

      if (!commandeId) {
        continue
      }

      const quantityToProduce = Math.min(
        Math.abs(movement.quantite),
        Math.max(0, -movement.stockApres),
      )

      if (quantityToProduce <= 0) {
        continue
      }

      const key = this.getProductionLineKey(commandeId, movement.articleId)

      productionQuantityByLine.set(
        key,
        (productionQuantityByLine.get(key) ?? 0) + quantityToProduce,
      )
    }

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

  private getProductionLineKey(commandeId: number, articleId: number) {
    return `${commandeId}:${articleId}`
  }

  private formatCommandeReference(id: number) {
    return `CMD-${String(id).padStart(6, '0')}`
  }

  private getPublicPaymentStatus(statut: string) {
    if (statut === 'annulee') {
      return 'annule'
    }

    if (statut === 'paiement_en_attente') {
      return 'en_attente'
    }

    if (statut === 'paiement_a_verifier') {
      return 'a_verifier'
    }

    return 'confirme'
  }

  private async recordStatusHistory(
    tx: {
      commandeStatutHistorique: {
        create: (args: {
          data: {
            commandeId: number
            ancienStatut?: string | null
            nouveauStatut: string
            motif?: string
            createdByUserId?: string
          }
        }) => Promise<unknown>
      }
    },
    data: {
      commandeId: number
      ancienStatut?: string | null
      nouveauStatut: string
      motif?: string
      createdByUserId?: string
    },
  ) {
    await tx.commandeStatutHistorique.create({
      data,
    })
  }

  private getStripe() {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY')

    if (!secretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY est manquant')
    }

    if (!this.stripe) {
      this.stripe = new Stripe(secretKey)
    }

    return this.stripe
  }

  private async prepareCommande(data: CreateCommandeDto) {
    validatePickupSlot(data.lieu, data.dateRetrait)

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
