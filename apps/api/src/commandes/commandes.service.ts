import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EmailsService } from '../emails/emails.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCommandeDto } from './dto/create-commande.dto'
import { CommandeStatut } from './dto/update-commande-statut.dto'
import { getPublicPickupPoints, validatePickupSlot } from './pickup-slots'
import { StripeCheckoutGateway } from './stripe-checkout.gateway'

type StockMovementTransaction = Parameters<
  MouvementsStockService['recordArticleMovement']
>[0]

type ReservationTransaction = StockMovementTransaction

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
  statut: string
  dateRetrait?: Date | null
  createdAt?: Date
  lignes: {
    id?: number
    articleId: number
    quantite: number
  }[]
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

type StripeWebhookClaim =
  | {
      claimed: true
      processingStartedAt: Date
    }
  | {
      claimed: false
      duplicate: true
    }

type CleanupAbandonedCommandesResult = {
  scanned: number
  cancelled: number
  skipped: number
  failed: number
  failures?: {
    commandeId: number
    reason: string
  }[]
}

type CleanupAbandonedCommandeStatus = 'cancelled' | 'skipped'

type ReleaseOrderReservationResult = {
  released: boolean
  alreadyReleased: boolean
  statusChanged: boolean
  order: {
    id: number
    statut: string
    createdAt?: Date
    lignes: ReservationLine[]
  }
}

type ReleaseOrderReservationOptions = {
  finalStatus: 'annulee'
  motif: string
  releasableStatuses: string[]
  idempotentStatuses?: string[]
  cutoff?: Date
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
export class CommandesService {
  private readonly logger = new Logger(CommandesService.name)
  private readonly abandonedDelayMinutes: number
  private readonly defaultStripeWebhookProcessingTimeoutMs = 300_000
  private readonly maxStripeWebhookErrorLength = 2_000
  private readonly defaultAbandonedOrderDelayMinutes = 60
  private readonly maxCleanupFailureReasonLength = 200
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly mouvementsStockService: MouvementsStockService,
    private readonly configService: ConfigService,
    private readonly emailsService: EmailsService,
    private readonly stripeCheckoutGateway: StripeCheckoutGateway,
  ) {
    this.abandonedDelayMinutes = this.parseAbandonedOrderDelayMinutes()
  }

  findPickupPoints() {
    return getPublicPickupPoints()
  }

  async findAll() {
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
    if (!this.configService.get<string>('STRIPE_SECRET_KEY')) {
      throw new BadRequestException('STRIPE_SECRET_KEY est manquant')
    }

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

    let session: Awaited<
      ReturnType<StripeCheckoutGateway['createCheckoutSession']>
    >

    try {
      session = await this.stripeCheckoutGateway.createCheckoutSession(
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
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    )
    const stripeSignature = Array.isArray(signature) ? signature[0] : signature

    if (!webhookSecret || !stripeSignature || !rawBody) {
      throw new BadRequestException('Webhook Stripe invalide')
    }

    let event: StripeCheckoutWebhookEvent

    try {
      event = this.stripeCheckoutGateway.constructWebhookEvent(
        rawBody,
        stripeSignature,
        webhookSecret,
      ) as StripeCheckoutWebhookEvent
    } catch (error) {
      throw new BadRequestException('Webhook Stripe invalide', {
        cause: error,
      })
    }

    const claim = await this.claimStripeWebhookEvent(event)

    if (!claim.claimed) {
      return { received: true, duplicate: true }
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const confirmedOrder = await this.confirmPaidCommande(
          event.data.object.id,
        )

        if (confirmedOrder) {
          await this.sendOrderConfirmationBestEffort(confirmedOrder)
        }
      }

      if (event.type === 'checkout.session.expired') {
        await this.expirePendingCommande(event.data.object.id)
      }

      await this.markStripeWebhookEventProcessed(
        event.id,
        claim.processingStartedAt,
      )

      return { received: true }
    } catch (error) {
      try {
        await this.markStripeWebhookEventFailed(
          event.id,
          claim.processingStartedAt,
          error,
        )
      } catch (markError) {
        this.logger.error(
          `Failed to mark Stripe webhook event ${event.id} as failed`,
          markError instanceof Error ? markError.stack : undefined,
        )
      }

      throw error
    }
  }

  async updateStatut(id: number, statut: CommandeStatut) {
    const commande = await this.findOne(id)

    if (statut === 'annulee' && commande.statut !== 'traitee') {
      return this.cancelCommande(id)
    }

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

    const candidates = await this.prisma.commande.findMany({
      where: {
        statut: 'paiement_en_attente',
        createdAt: {
          lt: cutoff,
        },
      },
      select: {
        id: true,
      },
    })

    const result: CleanupAbandonedCommandesResult = {
      scanned: candidates.length,
      cancelled: 0,
      skipped: 0,
      failed: 0,
    }
    const failures: NonNullable<CleanupAbandonedCommandesResult['failures']> =
      []

    for (const candidate of candidates) {
      try {
        const status = await this.cleanupAbandonedCommande(candidate.id, cutoff)

        if (status === 'cancelled') {
          result.cancelled += 1
        } else {
          result.skipped += 1
        }
      } catch (error) {
        result.failed += 1
        failures.push({
          commandeId: candidate.id,
          reason: this.formatCleanupFailureReason(error),
        })
      }
    }

    if (failures.length > 0) {
      result.failures = failures
    }

    return result
  }

  private async cleanupAbandonedCommande(
    commandeId: number,
    cutoff: Date,
  ): Promise<CleanupAbandonedCommandeStatus> {
    const result = await this.releaseOrderReservation(commandeId, {
      finalStatus: 'annulee',
      motif: 'commande_abandonnee',
      releasableStatuses: ['paiement_en_attente'],
      cutoff,
    })

    return result.released || result.statusChanged ? 'cancelled' : 'skipped'
  }

  private async cancelCommande(id: number) {
    let commande: {
      id: number
      statut: string
      lignes: ReservationLine[]
    } = await this.findOne(id)

    if (
      commande.statut === 'paiement_en_attente' ||
      commande.statut === 'paiement_a_verifier' ||
      commande.statut === 'annulee'
    ) {
      const result = await this.releaseOrderReservation(id, {
        finalStatus: 'annulee',
        motif: 'annulation',
        releasableStatuses: ['paiement_en_attente', 'paiement_a_verifier'],
        idempotentStatuses: ['annulee'],
      })

      if (
        result.released ||
        result.alreadyReleased ||
        result.statusChanged ||
        result.order.statut === 'annulee'
      ) {
        return result.order
      }

      commande = result.order
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
      const updateResult = await tx.commande.updateMany({
        where: {
          id: commande.id,
          statut: 'paiement_en_attente',
        },
        data: { statut: 'nouvelle' },
      })

      if (updateResult.count === 0) {
        return
      }

      await this.recordStatusHistory(tx, {
        commandeId: commande.id,
        ancienStatut: commande.statut,
        nouveauStatut: 'nouvelle',
        motif: 'paiement_confirme',
      })

      return tx.commande.findUniqueOrThrow({
        where: { id: commande.id },
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

  private async expirePendingCommande(stripeId: string) {
    const commandes = await this.prisma.commande.findMany({
      where: {
        stripeId,
        statut: 'paiement_en_attente',
      },
      select: { id: true },
    })

    for (const commande of commandes) {
      await this.releaseOrderReservation(commande.id, {
        finalStatus: 'annulee',
        motif: 'checkout_expire',
        releasableStatuses: ['paiement_en_attente'],
      })
    }
  }

  private async cancelCheckoutBeforePayment(commandeId: number, motif: string) {
    await this.releaseOrderReservation(commandeId, {
      finalStatus: 'annulee',
      motif,
      releasableStatuses: ['paiement_en_attente'],
    })
  }

  private async claimStripeWebhookEvent(
    event: StripeCheckoutWebhookEvent,
  ): Promise<StripeWebhookClaim> {
    const processingStartedAt = new Date()

    try {
      await this.prisma.stripeWebhookEvent.create({
        data: {
          eventId: event.id,
          type: event.type,
          status: 'processing',
          attempts: 1,
          lastError: null,
          processingStartedAt,
          processedAt: null,
        },
      })

      return { claimed: true, processingStartedAt }
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error
      }
    }

    return this.claimExistingStripeWebhookEvent(event, processingStartedAt)
  }

  private async claimExistingStripeWebhookEvent(
    event: StripeCheckoutWebhookEvent,
    processingStartedAt: Date,
  ): Promise<StripeWebhookClaim> {
    const existing = await this.prisma.stripeWebhookEvent.findUnique({
      where: { eventId: event.id },
    })

    if (!existing) {
      throw new ServiceUnavailableException(
        'Webhook Stripe en cours de traitement',
      )
    }

    if (existing.status === 'processed') {
      return { claimed: false, duplicate: true }
    }

    const staleProcessingBefore = new Date(
      Date.now() - this.getStripeWebhookProcessingTimeoutMs(),
    )

    const updateResult = await this.prisma.stripeWebhookEvent.updateMany({
      where: {
        eventId: event.id,
        OR: [
          { status: 'failed' },
          {
            status: 'processing',
            processingStartedAt: {
              lt: staleProcessingBefore,
            },
          },
        ],
      },
      data: {
        type: event.type,
        status: 'processing',
        attempts: {
          increment: 1,
        },
        lastError: null,
        processingStartedAt,
        processedAt: null,
      },
    })

    if (updateResult.count === 1) {
      return { claimed: true, processingStartedAt }
    }

    const latest = await this.prisma.stripeWebhookEvent.findUnique({
      where: { eventId: event.id },
    })

    if (latest?.status === 'processed') {
      return { claimed: false, duplicate: true }
    }

    throw new ServiceUnavailableException(
      'Webhook Stripe en cours de traitement',
    )
  }

  private async markStripeWebhookEventProcessed(
    eventId: string,
    processingStartedAt: Date,
  ) {
    const updateResult = await this.prisma.stripeWebhookEvent.updateMany({
      where: {
        eventId,
        status: 'processing',
        processingStartedAt,
      },
      data: {
        status: 'processed',
        processedAt: new Date(),
        lastError: null,
      },
    })

    if (updateResult.count !== 1) {
      throw new ServiceUnavailableException(
        'Webhook Stripe repris par une autre tentative',
      )
    }
  }

  private async markStripeWebhookEventFailed(
    eventId: string,
    processingStartedAt: Date,
    error: unknown,
  ) {
    await this.prisma.stripeWebhookEvent.updateMany({
      where: {
        eventId,
        status: 'processing',
        processingStartedAt,
      },
      data: {
        status: 'failed',
        lastError: this.formatStripeWebhookError(error),
        processedAt: null,
      },
    })
  }

  private async sendOrderConfirmationBestEffort(
    order: Awaited<ReturnType<CommandesService['confirmPaidCommande']>>,
  ) {
    if (!order) {
      return
    }

    try {
      await this.emailsService.sendOrderConfirmation(order)
    } catch (error) {
      this.logger.error(
        `Email confirmation failed for order #${order.id}`,
        error instanceof Error ? error.stack : undefined,
      )
    }
  }

  private getStripeWebhookProcessingTimeoutMs() {
    const configuredValue = this.configService.get<string>(
      'STRIPE_WEBHOOK_PROCESSING_TIMEOUT_MS',
    )
    const timeoutMs = configuredValue ? Number(configuredValue) : undefined

    if (!timeoutMs || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return this.defaultStripeWebhookProcessingTimeoutMs
    }

    return timeoutMs
  }

  private formatStripeWebhookError(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown webhook processing error'

    return message.slice(0, this.maxStripeWebhookErrorLength)
  }

  private parseAbandonedOrderDelayMinutes() {
    const configuredValue = this.configService.get<string>(
      'ABANDONED_ORDER_DELAY_MINUTES',
    )
    const delayMinutes = configuredValue ? Number(configuredValue) : undefined

    if (!delayMinutes || !Number.isFinite(delayMinutes) || delayMinutes <= 0) {
      return this.defaultAbandonedOrderDelayMinutes
    }

    return delayMinutes
  }

  private formatCleanupFailureReason(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown cleanup error'

    return message.slice(0, this.maxCleanupFailureReasonLength)
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

  private async releaseOrderReservation(
    commandeId: number,
    options: ReleaseOrderReservationOptions,
  ): Promise<ReleaseOrderReservationResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "Commande"
        WHERE "id" = ${commandeId}
        FOR UPDATE
      `

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

      if (options.cutoff && commande.createdAt >= options.cutoff) {
        return {
          released: false,
          alreadyReleased: false,
          statusChanged: false,
          order: commande,
        }
      }

      const idempotentStatuses = options.idempotentStatuses ?? [
        options.finalStatus,
      ]
      const releasable = options.releasableStatuses.includes(commande.statut)
      const alreadyFinal = idempotentStatuses.includes(commande.statut)

      if (!releasable && !alreadyFinal) {
        return {
          released: false,
          alreadyReleased: false,
          statusChanged: false,
          order: commande,
        }
      }

      const reservation = await tx.mouvementStock.findFirst({
        where: { reference: this.getReservationReference(commande.id) },
        select: { id: true },
      })

      const releaseOperationCreated = reservation
        ? await this.createReservationReleaseOperation(tx, commande.id)
        : false
      const alreadyReleased = Boolean(reservation && !releaseOperationCreated)

      if (releaseOperationCreated) {
        await this.restoreReservedStock(tx, commande)
      }

      const statusChanged =
        releasable && commande.statut !== options.finalStatus

      let order = commande

      if (statusChanged) {
        order = await tx.commande.update({
          where: { id: commande.id },
          data: { statut: options.finalStatus },
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
          nouveauStatut: options.finalStatus,
          motif: options.motif,
        })
      }

      return {
        released: releaseOperationCreated,
        alreadyReleased,
        statusChanged,
        order,
      }
    })
  }

  private async createReservationReleaseOperation(
    tx: ReservationTransaction,
    commandeId: number,
  ) {
    // This unique insert is the database-level idempotency gate for all
    // reservation release paths, including concurrent API instances.
    const rows = await tx.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "CommandeReservationRelease" ("commandeId")
      VALUES (${commandeId})
      ON CONFLICT ("commandeId") DO NOTHING
      RETURNING "id"
    `

    return rows.length === 1
  }

  private async restoreReservedStock(
    tx: ReservationTransaction,
    commande: {
      id: number
      lignes: ReservationLine[]
    },
  ) {
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

  private async withProductionNeeds<T extends CommandeWithProductionLines>(
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
