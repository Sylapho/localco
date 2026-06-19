import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'crypto'
import { EmailsService } from '../emails/emails.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PickupPointsService } from '../pickup-points/pickup-points.service'
import { PrismaService } from '../prisma/prisma.service'
import {
  canTransitionOrderStatus,
  isTerminalOrderStatus,
  OrderStatus,
} from './commande-status-transitions'
import { CreateCommandeDto } from './dto/create-commande.dto'
import { CommandeStatut } from './dto/update-commande-statut.dto'
import {
  CheckoutSessionExpirationResult,
  StripeCheckoutGateway,
} from './stripe-checkout.gateway'

type StockMovementTransaction = Parameters<
  MouvementsStockService['recordArticleMovement']
>[0]

type ReservationTransaction = StockMovementTransaction
type RawQueryTransaction = Pick<ReservationTransaction, '$queryRaw'>

type ReservationLine = {
  id?: number
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
    object: StripeCheckoutSessionWebhookObject
  }
}

type StripeCheckoutSessionWebhookObject = {
  id: string
  payment_status?: string | null
  amount_total?: number | null
  currency?: string | null
  client_reference_id?: string | null
  metadata?: Record<string, string | null | undefined> | null
}

type StripeCheckoutReconciliationOperation =
  | 'expire_checkout_session'
  | 'review_paid_pending_checkout'
  | 'review_paid_cancelled_checkout'
  | 'review_checkout_payment_mismatch'
  | 'review_checkout_attachment_conflict'
  | 'review_missing_checkout_session'
  | 'review_unmatched_checkout_session'

type StripeCheckoutReconciliationStatus =
  | 'pending'
  | 'manual_review'
  | 'resolved'
  | 'failed'

type CheckoutSessionCommandeCandidate = {
  id: number
  stripeId: string | null
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

type CleanupAbandonedCommandePreflight =
  | {
      eligible: true
      stripeSessionId: string
    }
  | {
      eligible: false
      reconciliation?: {
        stripeSessionId: string
        operation: StripeCheckoutReconciliationOperation
        lastError: string
      }
    }

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
  requiredStripeSessionId?: string | null
  reconciliation?: {
    stripeSessionId: string
    operation: StripeCheckoutReconciliationOperation
    lastError?: string
    attempts?: number
  }
}

type CommandeStockAllocationRow = {
  id: number
  stockLotId: number
  quantity: number
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

type PublicCommandeSummary = {
  trackingToken: string
  reference: string
  totalTtcCents: number
  lieu: string
  dateRetrait: string | null
  statut: string
  paiementStatut: 'confirme' | 'en_attente' | 'a_verifier' | 'annule'
  createdAt: string
  lignes: {
    nom: string
    quantite: number
    prixUnitCents: number
    totalCents: number
  }[]
}

@Injectable()
export class CommandesService {
  private readonly logger = new Logger(CommandesService.name)
  private readonly abandonedDelayMinutes: number
  private readonly defaultStripeWebhookProcessingTimeoutMs = 300_000
  private readonly maxStripeWebhookErrorLength = 2_000
  private readonly maxStripeReconciliationErrorLength = 1_000
  private readonly defaultAbandonedOrderDelayMinutes = 60
  private readonly maxCleanupFailureReasonLength = 200
  private readonly productionAllocationStatuses = [
    'paiement_en_attente',
    'paiement_a_verifier',
    'nouvelle',
    'preparee',
  ]
  private readonly cancellableStockReleaseStatuses = [
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
    private readonly pickupPointsService: PickupPointsService,
  ) {
    this.abandonedDelayMinutes = this.parseAbandonedOrderDelayMinutes()
  }

  findPickupPoints() {
    return this.pickupPointsService.findPublicPickupPoints()
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
        trackingToken: true,
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

    return this.toPublicCommandeSummary(commande)
  }

  async findPublicTrackingSummary(token: string) {
    const normalizedToken = token.trim()

    if (!normalizedToken) {
      throw new NotFoundException(
        'Commande introuvable ou lien de suivi invalide',
      )
    }

    const commande = await this.prisma.commande.findUnique({
      where: { trackingToken: normalizedToken },
      select: {
        id: true,
        trackingToken: true,
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
      throw new NotFoundException(
        'Commande introuvable ou lien de suivi invalide',
      )
    }

    return this.toPublicCommandeSummary(commande)
  }

  async create(data: CreateCommandeDto) {
    const { lignesAgregees, articles, totalTtcCents } =
      await this.prepareCommande(data)

    return this.prisma.$transaction(async (tx) => {
      const commande = await tx.commande.create({
        data: {
          nom: data.nom,
          trackingToken: this.generateTrackingToken(),
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

      await this.reserveCommandeStock(tx, {
        commandeId: commande.id,
        lignes: commande.lignes.length > 0 ? commande.lignes : lignesAgregees,
        articles,
        motif: `Commande en ligne #${commande.id}`,
        reference: `commande:${commande.id}`,
      })

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
          trackingToken: this.generateTrackingToken(),
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
        include: {
          lignes: true,
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
        lignes: created.lignes.length > 0 ? created.lignes : lignesAgregees,
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
      const expirationResult = await this.expireUnpersistedCheckoutSession(
        commande.id,
        session.id,
      )

      await this.cancelCheckoutBeforePayment(commande.id, {
        motif: 'checkout_stripe_id_update_echec',
        reconciliation:
          expirationResult.needsReconciliation === true
            ? {
                stripeSessionId: session.id,
                operation: 'expire_checkout_session',
                lastError: expirationResult.error,
                attempts: 1,
              }
            : undefined,
      })

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
          event.data.object,
          event.id,
        )

        if (confirmedOrder) {
          await this.sendOrderConfirmationBestEffort(confirmedOrder)
        }
      }

      if (event.type === 'checkout.session.expired') {
        await this.expirePendingCommande(event.data.object)
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
    if (statut === 'annulee') {
      return this.cancelCommande(id)
    }

    return this.transitionCommandeStatus(id, statut, 'statut_modifie')
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
    const preflight = await this.prepareAbandonedCommandeCleanup(
      commandeId,
      cutoff,
    )

    if (!preflight.eligible) {
      if (preflight.reconciliation) {
        await this.recordStripeCheckoutCleanupReconciliation(commandeId, {
          expectedStripeSessionId: null,
          stripeSessionId: preflight.reconciliation.stripeSessionId,
          operation: preflight.reconciliation.operation,
          lastError: preflight.reconciliation.lastError,
          attempts: 0,
        })
      }

      return 'skipped'
    }

    const expirationResult =
      await this.stripeCheckoutGateway.expireCheckoutSession(
        preflight.stripeSessionId,
      )

    if (
      expirationResult.status !== 'expired' &&
      expirationResult.status !== 'already_expired'
    ) {
      await this.handleAbandonedCheckoutExpirationBlocked(
        commandeId,
        preflight.stripeSessionId,
        expirationResult,
      )

      return 'skipped'
    }

    const result = await this.releaseOrderReservation(commandeId, {
      finalStatus: 'annulee',
      motif: 'commande_abandonnee',
      releasableStatuses: ['paiement_en_attente'],
      cutoff,
      requiredStripeSessionId: preflight.stripeSessionId,
    })

    return result.released || result.statusChanged ? 'cancelled' : 'skipped'
  }

  private async prepareAbandonedCommandeCleanup(
    commandeId: number,
    cutoff: Date,
  ): Promise<CleanupAbandonedCommandePreflight> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "Commande"
        WHERE "id" = ${commandeId}
        FOR UPDATE
      `

      const commande = await tx.commande.findUniqueOrThrow({
        where: { id: commandeId },
        select: {
          id: true,
          statut: true,
          stripeId: true,
          createdAt: true,
        },
      })

      if (
        commande.statut !== 'paiement_en_attente' ||
        commande.createdAt >= cutoff
      ) {
        return { eligible: false }
      }

      if (!commande.stripeId) {
        return {
          eligible: false,
          reconciliation: {
            stripeSessionId: this.getMissingCheckoutSessionReference(
              commande.id,
            ),
            operation: 'review_missing_checkout_session',
            lastError:
              'Abandoned pending payment order has no Stripe checkout session id',
          },
        }
      }

      return {
        eligible: true,
        stripeSessionId: commande.stripeId,
      }
    })
  }

  private async handleAbandonedCheckoutExpirationBlocked(
    commandeId: number,
    stripeSessionId: string,
    expirationResult: Exclude<
      CheckoutSessionExpirationResult,
      { status: 'expired' | 'already_expired' }
    >,
  ) {
    if (expirationResult.status === 'already_paid') {
      await this.recordStripeCheckoutCleanupReconciliation(commandeId, {
        expectedStripeSessionId: stripeSessionId,
        stripeSessionId,
        operation: 'review_paid_pending_checkout',
        lastError: expirationResult.paymentIntentId
          ? `Stripe checkout session is already paid with payment intent ${expirationResult.paymentIntentId}`
          : 'Stripe checkout session is already paid',
        attempts: 0,
      })

      return
    }

    if (expirationResult.status === 'not_found') {
      await this.recordStripeCheckoutCleanupReconciliation(commandeId, {
        expectedStripeSessionId: stripeSessionId,
        stripeSessionId,
        operation: 'expire_checkout_session',
        lastError:
          'Stripe checkout session was not found while cleaning abandoned order',
        attempts: 1,
      })

      return
    }

    await this.recordStripeCheckoutCleanupReconciliation(commandeId, {
      expectedStripeSessionId: stripeSessionId,
      stripeSessionId,
      operation: 'expire_checkout_session',
      lastError: expirationResult.reason,
      attempts: 1,
    })
  }

  private async recordStripeCheckoutCleanupReconciliation(
    commandeId: number,
    data: {
      expectedStripeSessionId: string | null
      stripeSessionId: string
      operation: StripeCheckoutReconciliationOperation
      lastError: string
      attempts: number
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "Commande"
        WHERE "id" = ${commandeId}
        FOR UPDATE
      `

      const commande = await tx.commande.findUniqueOrThrow({
        where: { id: commandeId },
        select: {
          id: true,
          statut: true,
          stripeId: true,
        },
      })

      if (
        data.expectedStripeSessionId !== null &&
        commande.stripeId !== data.expectedStripeSessionId
      ) {
        return
      }

      if (commande.statut === 'nouvelle') {
        return
      }

      const operation =
        data.operation === 'review_paid_pending_checkout' &&
        commande.statut === 'annulee'
          ? 'review_paid_cancelled_checkout'
          : data.operation

      await this.createActiveStripeCheckoutReconciliation(tx, {
        commandeId: commande.id,
        stripeSessionId: data.stripeSessionId,
        operation,
        lastError: data.lastError,
        attempts: data.attempts,
      })
    })
  }

  private async cancelCommande(id: number) {
    const result = await this.releaseOrderReservation(id, {
      finalStatus: 'annulee',
      motif: 'annulation',
      releasableStatuses: this.cancellableStockReleaseStatuses,
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

    if (isTerminalOrderStatus(result.order.statut)) {
      throw new ConflictException({
        code: 'ORDER_STATUS_CONFLICT',
        message: 'Le statut de cette commande a deja change',
        currentStatus: result.order.statut,
        targetStatus: 'annulee',
      })
    }

    throw new BadRequestException('Cette commande ne peut pas être annulée')
  }

  private async transitionCommandeStatus(
    commandeId: number,
    nextStatus: OrderStatus,
    motif: string,
  ) {
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

      this.assertCommandeTransitionAllowedOrThrow(commande.statut, nextStatus)

      const updated = await tx.commande.update({
        where: { id: commande.id },
        data: { statut: nextStatus },
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
        nouveauStatut: nextStatus,
        motif,
      })

      return updated
    })
  }

  private assertCommandeTransitionAllowedOrThrow(
    currentStatus: string,
    nextStatus: OrderStatus,
  ) {
    if (canTransitionOrderStatus(currentStatus, nextStatus)) {
      return
    }

    if (isTerminalOrderStatus(currentStatus)) {
      throw new ConflictException({
        code: 'ORDER_STATUS_CONFLICT',
        message: 'Le statut de cette commande a deja change',
        currentStatus,
        targetStatus: nextStatus,
      })
    }

    throw new BadRequestException({
      code: 'ORDER_STATUS_TRANSITION_FORBIDDEN',
      message: 'Transition de statut interdite',
      currentStatus,
      targetStatus: nextStatus,
    })
  }

  private async confirmPaidCommande(
    session: StripeCheckoutSessionWebhookObject,
    eventId: string,
  ) {
    const resolvedCommande = await this.resolveCommandeForCheckoutSession(
      session,
      eventId,
    )

    if (!resolvedCommande) {
      return
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM "Commande"
        WHERE "id" = ${resolvedCommande.id}
        FOR UPDATE
      `

      const lockedCommande = await tx.commande.findUniqueOrThrow({
        where: { id: resolvedCommande.id },
        include: {
          lignes: {
            include: {
              article: true,
            },
          },
        },
      })

      const anomaly = this.validateCheckoutSessionForCommande(
        session,
        lockedCommande,
      )

      if (anomaly) {
        await this.createActiveStripeCheckoutReconciliation(tx, {
          commandeId: lockedCommande.id,
          stripeSessionId: session.id,
          operation: anomaly.operation,
          lastError: anomaly.reason,
          attempts: 0,
        })
        this.logger.warn({
          message: 'Stripe checkout session requires reconciliation',
          commandeId: lockedCommande.id,
          stripeSessionId: session.id,
          stripeEventId: eventId,
          reconciliationOperation: anomaly.operation,
          reason: anomaly.reason,
        })

        return
      }

      if (lockedCommande.statut !== 'paiement_en_attente') {
        if (lockedCommande.statut === 'annulee') {
          await this.createActiveStripeCheckoutReconciliation(tx, {
            commandeId: lockedCommande.id,
            stripeSessionId: session.id,
            operation: 'review_paid_cancelled_checkout',
            lastError: 'Paid checkout session received for cancelled order',
            attempts: 0,
          })
          this.logger.warn({
            message:
              'Paid Stripe checkout session received for cancelled order',
            commandeId: lockedCommande.id,
            stripeSessionId: session.id,
            stripeEventId: eventId,
            reconciliationOperation: 'review_paid_cancelled_checkout',
          })
        }

        return
      }

      this.assertCommandeTransitionAllowedOrThrow(
        lockedCommande.statut,
        'nouvelle',
      )

      const updated = await tx.commande.update({
        where: { id: lockedCommande.id },
        data: {
          statut: 'nouvelle',
          stripeId: lockedCommande.stripeId ?? session.id,
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
        commandeId: lockedCommande.id,
        ancienStatut: lockedCommande.statut,
        nouveauStatut: 'nouvelle',
        motif: 'paiement_confirme',
      })

      return updated
    })
  }

  private async expirePendingCommande(
    session: StripeCheckoutSessionWebhookObject,
  ) {
    const commande = await this.resolveCommandeForCheckoutSession(session)

    if (!commande) {
      return
    }

    await this.releaseOrderReservation(commande.id, {
      finalStatus: 'annulee',
      motif: 'checkout_expire',
      releasableStatuses: ['paiement_en_attente'],
    })
  }

  private async cancelCheckoutBeforePayment(
    commandeId: number,
    options:
      | string
      | {
          motif: string
          reconciliation?: {
            stripeSessionId: string
            operation: StripeCheckoutReconciliationOperation
            lastError?: string
            attempts?: number
          }
        },
  ) {
    const normalizedOptions =
      typeof options === 'string' ? { motif: options } : options

    await this.releaseOrderReservation(commandeId, {
      finalStatus: 'annulee',
      motif: normalizedOptions.motif,
      releasableStatuses: ['paiement_en_attente'],
      reconciliation: normalizedOptions.reconciliation,
    })
  }

  private async expireUnpersistedCheckoutSession(
    commandeId: number,
    stripeSessionId: string,
  ) {
    const result =
      await this.stripeCheckoutGateway.expireCheckoutSession(stripeSessionId)

    this.logger.log({
      message: 'Stripe checkout session expiration attempted',
      commandeId,
      stripeSessionId,
      reconciliationOperation: 'expire_checkout_session',
      result: result.status,
    })

    if (result.status === 'expired' || result.status === 'already_expired') {
      return { needsReconciliation: false as const }
    }

    if (result.status === 'failed') {
      const formattedError = this.formatStripeReconciliationError(result.reason)

      this.logger.error({
        message: 'Stripe checkout session expiration failed',
        commandeId,
        stripeSessionId,
        reconciliationOperation: 'expire_checkout_session',
        error: formattedError,
      })

      return {
        needsReconciliation: true as const,
        error: formattedError,
      }
    }

    return {
      needsReconciliation: true as const,
      error: this.formatStripeReconciliationError(
        `Stripe checkout session expiration did not neutralize the session: ${result.status}`,
      ),
    }
  }

  private async resolveCommandeForCheckoutSession(
    session: StripeCheckoutSessionWebhookObject,
    eventId?: string,
  ): Promise<CheckoutSessionCommandeCandidate | undefined> {
    const metadataCommandeId = this.parseStripeCommandeId(
      session.metadata?.commandeId,
    )
    const clientReferenceCommandeId = this.parseStripeCommandeId(
      session.client_reference_id,
    )
    const candidateIds = Array.from(
      new Set(
        [metadataCommandeId, clientReferenceCommandeId].filter(
          (id): id is number => id !== undefined,
        ),
      ),
    )

    const commandes = await this.prisma.commande.findMany({
      where: {
        OR: [
          { stripeId: session.id },
          ...(candidateIds.length > 0
            ? [
                {
                  id: {
                    in: candidateIds,
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        stripeId: true,
      },
    })

    if (commandes.length === 0) {
      await this.createActiveStripeCheckoutReconciliation(this.prisma, {
        commandeId: null,
        stripeSessionId: session.id,
        operation: 'review_unmatched_checkout_session',
        status: 'manual_review',
        lastError: 'Stripe checkout session could not be attached to an order',
        manualReviewReason:
          'Webhook received for a checkout session that does not match any order',
        metadata: {
          stripeEventId: eventId,
          clientReferenceId: session.client_reference_id ?? null,
          metadataCommandeId: session.metadata?.commandeId ?? null,
          paymentStatus: session.payment_status ?? null,
        },
      })
      this.logger.warn({
        message: 'Stripe checkout session could not be attached to an order',
        stripeSessionId: session.id,
        stripeEventId: eventId,
        reconciliationOperation: 'review_unmatched_checkout_session',
      })

      return
    }

    const matchedIds = new Set<number>()

    for (const commande of commandes) {
      if (commande.stripeId === session.id) {
        matchedIds.add(commande.id)
      }
    }

    for (const candidateId of candidateIds) {
      if (commandes.some((commande) => commande.id === candidateId)) {
        matchedIds.add(candidateId)
      }
    }

    if (matchedIds.size === 1) {
      const [commandeId] = matchedIds
      const commande = commandes.find((item) => item.id === commandeId)!

      return commande
    }

    const fallbackCommandeId = commandes[0].id

    await this.createActiveStripeCheckoutReconciliation(this.prisma, {
      commandeId: fallbackCommandeId,
      stripeSessionId: session.id,
      operation: 'review_checkout_attachment_conflict',
      lastError: `Conflicting checkout attachments: ${Array.from(
        matchedIds,
      ).join(', ')}`,
      attempts: 0,
    })
    this.logger.warn({
      message: 'Stripe checkout session has conflicting order attachments',
      commandeId: fallbackCommandeId,
      stripeSessionId: session.id,
      stripeEventId: eventId,
      reconciliationOperation: 'review_checkout_attachment_conflict',
    })

    return
  }

  private parseStripeCommandeId(value: string | null | undefined) {
    if (!value || !/^[1-9]\d*$/.test(value)) {
      return undefined
    }

    return Number(value)
  }

  private validateCheckoutSessionForCommande(
    session: StripeCheckoutSessionWebhookObject,
    commande: {
      id: number
      statut: string
      stripeId: string | null
      totalTtcCents: number
    },
  ):
    | {
        operation: StripeCheckoutReconciliationOperation
        reason: string
      }
    | undefined {
    if (session.payment_status !== 'paid') {
      return {
        operation: 'review_checkout_payment_mismatch',
        reason: `Unexpected payment_status: ${session.payment_status ?? 'missing'}`,
      }
    }

    if ((session.currency ?? '').toLowerCase() !== 'eur') {
      return {
        operation: 'review_checkout_payment_mismatch',
        reason: `Unexpected currency: ${session.currency ?? 'missing'}`,
      }
    }

    if (session.amount_total !== commande.totalTtcCents) {
      return {
        operation: 'review_checkout_payment_mismatch',
        reason: `Unexpected amount_total: ${session.amount_total ?? 'missing'}`,
      }
    }

    if (commande.stripeId && commande.stripeId !== session.id) {
      return {
        operation: 'review_checkout_attachment_conflict',
        reason: 'Persisted stripeId does not match checkout session id',
      }
    }

    if (
      session.metadata?.commandeId &&
      this.parseStripeCommandeId(session.metadata.commandeId) === undefined
    ) {
      return {
        operation: 'review_checkout_attachment_conflict',
        reason: 'Invalid metadata.commandeId',
      }
    }

    if (
      session.client_reference_id &&
      this.parseStripeCommandeId(session.client_reference_id) === undefined
    ) {
      return {
        operation: 'review_checkout_attachment_conflict',
        reason: 'Invalid client_reference_id',
      }
    }

    const metadataCommandeId = this.parseStripeCommandeId(
      session.metadata?.commandeId,
    )
    const clientReferenceCommandeId = this.parseStripeCommandeId(
      session.client_reference_id,
    )

    if (
      metadataCommandeId !== undefined &&
      metadataCommandeId !== commande.id
    ) {
      return {
        operation: 'review_checkout_attachment_conflict',
        reason: 'metadata.commandeId does not match attached order',
      }
    }

    if (
      clientReferenceCommandeId !== undefined &&
      clientReferenceCommandeId !== commande.id
    ) {
      return {
        operation: 'review_checkout_attachment_conflict',
        reason: 'client_reference_id does not match attached order',
      }
    }

    if (
      commande.statut !== 'paiement_en_attente' &&
      commande.statut !== 'nouvelle'
    ) {
      return {
        operation:
          commande.statut === 'annulee'
            ? 'review_paid_cancelled_checkout'
            : 'review_checkout_payment_mismatch',
        reason: `Order status cannot be confirmed: ${commande.statut}`,
      }
    }

    return undefined
  }

  private async createActiveStripeCheckoutReconciliation(
    tx: RawQueryTransaction,
    data: {
      commandeId?: number | null
      stripeSessionId: string
      operation: StripeCheckoutReconciliationOperation
      status?: StripeCheckoutReconciliationStatus
      lastError?: string
      attempts?: number
      nextAttemptAt?: Date
      manualReviewReason?: string
      metadata?: unknown
    },
  ) {
    const lastError = data.lastError
      ? data.lastError.slice(0, this.maxStripeReconciliationErrorLength)
      : null
    const attempts = data.attempts ?? 0
    const lastAttemptedAt = attempts > 0 ? new Date() : null
    const status = data.status ?? 'pending'
    const nextAttemptAt = data.nextAttemptAt ?? new Date()
    const manualReviewReason = data.manualReviewReason ?? null
    const metadata = data.metadata ? JSON.stringify(data.metadata) : null

    await tx.$queryRaw`
      INSERT INTO "StripeCheckoutReconciliation" (
        "commandeId",
        "stripeSessionId",
        "operation",
        "status",
        "attempts",
        "lastError",
        "lastAttemptedAt",
        "nextAttemptAt",
        "manualReviewReason",
        "metadata",
        "updatedAt"
      )
      VALUES (
        ${data.commandeId ?? null},
        ${data.stripeSessionId},
        ${data.operation}::"StripeCheckoutReconciliationOperation",
        ${status}::"StripeCheckoutReconciliationStatus",
        ${attempts},
        ${lastError},
        ${lastAttemptedAt},
        ${nextAttemptAt},
        ${manualReviewReason},
        ${metadata}::jsonb,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("stripeSessionId", "operation")
      WHERE "status" <> 'resolved'
      DO UPDATE SET
        "commandeId" = EXCLUDED."commandeId",
        "status" = EXCLUDED."status",
        "attempts" = "StripeCheckoutReconciliation"."attempts" + EXCLUDED."attempts",
        "lastError" = EXCLUDED."lastError",
        "lastAttemptedAt" = COALESCE(EXCLUDED."lastAttemptedAt", "StripeCheckoutReconciliation"."lastAttemptedAt"),
        "nextAttemptAt" = EXCLUDED."nextAttemptAt",
        "manualReviewReason" = COALESCE(EXCLUDED."manualReviewReason", "StripeCheckoutReconciliation"."manualReviewReason"),
        "metadata" = COALESCE(EXCLUDED."metadata", "StripeCheckoutReconciliation"."metadata"),
        "claimedAt" = NULL,
        "claimedBy" = NULL,
        "leaseExpiresAt" = NULL,
        "failedAt" = NULL,
        "resolvedAt" = NULL,
        "updatedAt" = CURRENT_TIMESTAMP
    `
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

  private formatStripeReconciliationError(error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown Stripe reconciliation error'

    return message.slice(0, this.maxStripeReconciliationErrorLength)
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

      if (
        options.requiredStripeSessionId !== undefined &&
        commande.stripeId !== options.requiredStripeSessionId
      ) {
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

      const releaseOperationCreated = releasable
        ? await this.createReservationReleaseOperation(tx, commande.id)
        : false
      const alreadyReleased = releasable && !releaseOperationCreated

      if (releaseOperationCreated) {
        await this.restoreReservedStock(tx, commande)
      }

      const statusChanged =
        releasable && commande.statut !== options.finalStatus

      let order = commande

      if (statusChanged) {
        this.assertCommandeTransitionAllowedOrThrow(
          commande.statut,
          options.finalStatus,
        )

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

      if (options.reconciliation) {
        await this.createActiveStripeCheckoutReconciliation(tx, {
          commandeId: commande.id,
          stripeSessionId: options.reconciliation.stripeSessionId,
          operation: options.reconciliation.operation,
          lastError: options.reconciliation.lastError,
          attempts: options.reconciliation.attempts ?? 0,
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
      const stockApres = stockAvant + ligne.quantite
      await tx.article.update({
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
        stockApres,
        type: 'commande',
        motif: `Lib\u00e9ration r\u00e9servation commande #${commande.id}`,
        reference: this.getReservationReleaseReference(commande.id),
      })

      if (!ligne.id) {
        this.logger.warn({
          message: 'Order line has no id while restoring stock allocation',
          commandeId: commande.id,
          articleId: ligne.articleId,
        })
        continue
      }

      await this.restoreLineStockAllocations(tx, {
        commandeId: commande.id,
        ligneCommandeId: ligne.id,
      })
    }
  }

  private async restoreLineStockAllocations(
    tx: ReservationTransaction,
    data: {
      commandeId: number
      ligneCommandeId: number
    },
  ) {
    const allocations = await tx.$queryRaw<CommandeStockAllocationRow[]>`
      SELECT "id", "stockLotId", "quantity"
      FROM "CommandeStockAllocation"
      WHERE "commandeId" = ${data.commandeId}
        AND "ligneCommandeId" = ${data.ligneCommandeId}
        AND "restoredAt" IS NULL
      ORDER BY "stockLotId" ASC, "id" ASC
      FOR UPDATE
    `

    if (allocations.length === 0) {
      this.logger.warn({
        message:
          'No physical stock allocation found while restoring order line',
        commandeId: data.commandeId,
        ligneCommandeId: data.ligneCommandeId,
      })
      return
    }

    for (const allocation of allocations) {
      await tx.$queryRaw`
        SELECT "id"
        FROM "StockLot"
        WHERE "id" = ${allocation.stockLotId}
        FOR UPDATE
      `

      await tx.stockLot.update({
        where: { id: allocation.stockLotId },
        data: {
          remainingQuantity: {
            increment: allocation.quantity,
          },
        },
      })
      await tx.commandeStockAllocation.update({
        where: { id: allocation.id },
        data: {
          restoredAt: new Date(),
        },
      })
    }
  }

  private getReservationReference(commandeId: number) {
    return `commande:${commandeId}:reservation`
  }

  private getReservationReleaseReference(commandeId: number) {
    return `commande:${commandeId}:reservation:release`
  }

  private getMissingCheckoutSessionReference(commandeId: number) {
    return `commande:${commandeId}:missing-checkout-session`
  }

  private generateTrackingToken() {
    return randomBytes(24).toString('base64url')
  }

  private toPublicCommandeSummary(commande: {
    id: number
    trackingToken: string
    totalTtcCents: number
    lieu: string
    dateRetrait?: Date | null
    statut: string
    createdAt: Date
    lignes: {
      quantite: number
      prixUnitCents: number
      article: {
        nom: string
      }
    }[]
  }): PublicCommandeSummary {
    return {
      trackingToken: commande.trackingToken,
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
