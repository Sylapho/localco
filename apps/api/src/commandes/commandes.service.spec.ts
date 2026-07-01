import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import Stripe from 'stripe'
import { EmailsService } from '../emails/emails.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PickupPointsService } from '../pickup-points/pickup-points.service'
import { PrismaService } from '../prisma/prisma.service'
import { CommandePreparationService } from './commande-preparation.service'
import { CommandeProductionNeedsService } from './commande-production-needs.service'
import { CommandePublicSummaryService } from './commande-public-summary.service'
import { CommandeStatusHistoryService } from './commande-status-history.service'
import { CommandeStockReservationService } from './commande-stock-reservation.service'
import { CommandesService } from './commandes.service'
import { CreateCommandeDto } from './dto/create-commande.dto'
import { CommandeStatut } from './dto/update-commande-statut.dto'
import { StripeCheckoutGateway } from './stripe-checkout.gateway'

const mockStripeCheckoutSessionsCreate = jest.fn()
const mockStripeCheckoutSessionsRetrieve = jest.fn()
const mockStripeCheckoutSessionsExpire = jest.fn()
const mockStripeConstructEvent = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockStripeCheckoutSessionsCreate,
        retrieve: mockStripeCheckoutSessionsRetrieve,
        expire: mockStripeCheckoutSessionsExpire,
      },
    },
    webhooks: {
      constructEvent: mockStripeConstructEvent,
    },
  }))
})

type ArticleMock = {
  id: number
  nom: string
  prixCents: number
  stock: number
  online?: boolean
  imageUrl?: string | null
}

type CommandeLigneMock = {
  id?: number
  articleId: number
  quantite: number
  article?: {
    stock: number
  } | null
}

type CommandeMock = {
  id: number
  statut: string
  stripeId?: string | null
  totalTtcCents?: number
  lignes: CommandeLigneMock[]
}

describe('CommandesService', () => {
  let service: CommandesService

  const prismaMock = {
    article: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    commande: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    commandeStatutHistorique: {
      create: jest.fn(),
    },
    ligneCommande: {
      update: jest.fn(),
    },
    commandeStockAllocation: {
      create: jest.fn(),
      update: jest.fn(),
    },
    mouvementStock: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    stockLot: {
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    stripeWebhookEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  }

  const mouvementsStockServiceMock = {
    recordArticleMovement: jest.fn(),
    getSellableArticleStock: jest.fn(),
  }

  const configServiceMock = {
    get: jest.fn(),
  }

  const emailsServiceMock = {
    sendOrderConfirmation: jest.fn(),
  }

  const pickupPointsServiceMock = {
    findPublicPickupPoints: jest.fn(),
    validatePickupSlot: jest.fn(),
  }

  type TransactionClient = {
    $queryRaw: jest.Mock
    article: typeof prismaMock.article
    commande: typeof prismaMock.commande
    commandeStatutHistorique: typeof prismaMock.commandeStatutHistorique
    ligneCommande: typeof prismaMock.ligneCommande
    commandeStockAllocation: typeof prismaMock.commandeStockAllocation
    mouvementStock: typeof prismaMock.mouvementStock
    stockLot: typeof prismaMock.stockLot
  }

  type TransactionCallback<T> = (tx: TransactionClient) => Promise<T>

  const transactionClient: TransactionClient = {
    $queryRaw: jest.fn(),
    article: prismaMock.article,
    commande: prismaMock.commande,
    commandeStatutHistorique: prismaMock.commandeStatutHistorique,
    ligneCommande: prismaMock.ligneCommande,
    commandeStockAllocation: prismaMock.commandeStockAllocation,
    mouvementStock: prismaMock.mouvementStock,
    stockLot: prismaMock.stockLot,
  }

  const validPickupPoint = 'Marché de Gaillon - Mardi matin, 8h-12h'
  const validPickupDate = getNextDateForWeekday(2)

  const baseDto = (
    overrides: Partial<CreateCommandeDto> = {},
  ): CreateCommandeDto => ({
    nom: 'Marie Dupont',
    email: 'marie@example.fr',
    tel: '0612345678',
    lieu: validPickupPoint,
    dateRetrait: validPickupDate,
    lignes: [{ articleId: 1, quantite: 2 }],
    ...overrides,
  })

  const checkoutSessionWebhookObject = (
    id: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    id,
    payment_status: 'paid',
    amount_total: 1250,
    currency: 'eur',
    ...overrides,
  })

  const makeCommandeForProduction = (data: {
    id: number
    articleId?: number
    quantite: number
    statut?: string
    stock?: number
    dateRetrait?: Date | null
    createdAt?: Date
  }) => ({
    id: data.id,
    statut: data.statut ?? 'nouvelle',
    dateRetrait: data.dateRetrait ?? null,
    createdAt: data.createdAt ?? new Date(Date.UTC(2026, 5, 10, 8, data.id)),
    lignes: [
      {
        id: data.id * 10,
        articleId: data.articleId ?? 1,
        quantite: data.quantite,
        article: {
          id: data.articleId ?? 1,
          nom: `Article ${data.articleId ?? 1}`,
          stock: data.stock ?? 0,
        },
      },
    ],
  })

  const mockProductionLookup = (data: {
    currentStock: number
    openCommandes: ReturnType<typeof makeCommandeForProduction>[]
    articleId?: number
  }) => {
    const articleId = data.articleId ?? 1

    prismaMock.article.findMany.mockResolvedValueOnce([
      {
        id: articleId,
        stock: data.currentStock,
      },
    ])
    prismaMock.commande.findMany.mockResolvedValueOnce(
      data.openCommandes.map((commande) => ({
        id: commande.id,
        statut: commande.statut,
        dateRetrait: commande.dateRetrait,
        createdAt: commande.createdAt,
        lignes: commande.lignes.map((ligne) => ({
          articleId: ligne.articleId,
          quantite: ligne.quantite,
        })),
      })),
    )
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandesService,
        StripeCheckoutGateway,
        CommandePreparationService,
        CommandeProductionNeedsService,
        CommandePublicSummaryService,
        CommandeStatusHistoryService,
        CommandeStockReservationService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: MouvementsStockService,
          useValue: mouvementsStockServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: EmailsService,
          useValue: emailsServiceMock,
        },
        {
          provide: PickupPointsService,
          useValue: pickupPointsServiceMock,
        },
      ],
    }).compile()

    service = module.get<CommandesService>(CommandesService)

    jest.clearAllMocks()
    ;[
      prismaMock.article.findMany,
      prismaMock.article.update,
      prismaMock.commande.findMany,
      prismaMock.commande.findFirst,
      prismaMock.commande.findUnique,
      prismaMock.commande.findUniqueOrThrow,
      prismaMock.commande.create,
      prismaMock.commande.update,
      prismaMock.commande.updateMany,
      prismaMock.commandeStatutHistorique.create,
      prismaMock.ligneCommande.update,
      prismaMock.commandeStockAllocation.create,
      prismaMock.commandeStockAllocation.update,
      prismaMock.mouvementStock.findFirst,
      prismaMock.mouvementStock.findMany,
      prismaMock.mouvementStock.create,
      prismaMock.stockLot.aggregate,
      prismaMock.stockLot.create,
      prismaMock.stockLot.update,
      prismaMock.stripeWebhookEvent.create,
      prismaMock.stripeWebhookEvent.findUnique,
      prismaMock.stripeWebhookEvent.updateMany,
      prismaMock.$queryRaw,
      prismaMock.$transaction,
      transactionClient.$queryRaw,
      mouvementsStockServiceMock.recordArticleMovement,
      mouvementsStockServiceMock.getSellableArticleStock,
      configServiceMock.get,
      emailsServiceMock.sendOrderConfirmation,
      pickupPointsServiceMock.findPublicPickupPoints,
      pickupPointsServiceMock.validatePickupSlot,
      mockStripeCheckoutSessionsCreate,
      mockStripeCheckoutSessionsRetrieve,
      mockStripeCheckoutSessionsExpire,
      mockStripeConstructEvent,
    ].forEach((mock) => mock.mockReset())

    prismaMock.$transaction.mockImplementation(
      async <T>(callback: TransactionCallback<T>) =>
        callback(transactionClient),
    )
    transactionClient.$queryRaw.mockResolvedValue([{ id: 1 }])

    prismaMock.article.findMany.mockResolvedValue([])
    prismaMock.commande.findMany.mockResolvedValue([])
    prismaMock.commande.findUnique.mockResolvedValue(null)
    prismaMock.commande.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.commandeStatutHistorique.create.mockResolvedValue({ id: 1 })
    prismaMock.ligneCommande.update.mockResolvedValue({ id: 1 })
    prismaMock.commandeStockAllocation.create.mockResolvedValue({ id: 1 })
    prismaMock.commandeStockAllocation.update.mockResolvedValue({ id: 1 })
    prismaMock.mouvementStock.findFirst.mockResolvedValue(null)
    prismaMock.mouvementStock.findMany.mockResolvedValue([])
    prismaMock.mouvementStock.create.mockResolvedValue({ id: 1 })
    prismaMock.stockLot.aggregate.mockResolvedValue({
      _sum: {
        remainingQuantity: 0,
      },
    })
    prismaMock.stockLot.create.mockResolvedValue({ id: 1 })
    prismaMock.stockLot.update.mockResolvedValue({ id: 1 })
    prismaMock.stripeWebhookEvent.create.mockResolvedValue({ id: 1 })
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.stripeWebhookEvent.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.$queryRaw.mockResolvedValue([])

    mouvementsStockServiceMock.recordArticleMovement.mockResolvedValue({
      movement: { id: 1 },
      consumedLots: [],
    })

    mouvementsStockServiceMock.getSellableArticleStock.mockResolvedValue(
      new Map(),
    )

    configServiceMock.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_localco',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_localco',
        SHOP_PUBLIC_URL: 'http://localhost:3000',
      }

      return values[key]
    })

    pickupPointsServiceMock.findPublicPickupPoints.mockResolvedValue([])
    pickupPointsServiceMock.validatePickupSlot.mockResolvedValue(undefined)

    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })
    mockStripeCheckoutSessionsRetrieve.mockResolvedValue({
      id: 'cs_test_123',
      status: 'open',
      payment_status: 'unpaid',
    })
    mockStripeCheckoutSessionsExpire.mockResolvedValue({
      id: 'cs_test_123',
      status: 'expired',
      payment_status: 'unpaid',
    })

    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_unhandled',
      type: 'unhandled.event',
      data: {
        object: {
          id: 'evt_unused',
        },
      },
    })

    emailsServiceMock.sendOrderConfirmation.mockResolvedValue(undefined)
  })

  it('findAll should list visible commandes without cleanup side effects', async () => {
    const commandes = [{ id: 1, statut: 'nouvelle', lignes: [] }]

    prismaMock.commande.findMany.mockResolvedValueOnce(commandes)

    await expect(service.findAll()).resolves.toEqual(commandes)

    expect(prismaMock.commande.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.commande.findMany).toHaveBeenCalledWith({
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
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(prismaMock.mouvementStock.create).not.toHaveBeenCalled()
  })

  it('findAll should allocate production needs from current stock and open orders', async () => {
    const firstCommande = makeCommandeForProduction({
      id: 1,
      quantite: 5,
      stock: -4,
      dateRetrait: new Date('2026-06-16T00:00:00.000Z'),
      createdAt: new Date('2026-06-10T08:00:00.000Z'),
    })
    const secondCommande = makeCommandeForProduction({
      id: 2,
      quantite: 2,
      stock: -4,
      dateRetrait: new Date('2026-06-19T00:00:00.000Z'),
      createdAt: new Date('2026-06-10T09:00:00.000Z'),
    })
    const commandes = [firstCommande, secondCommande]

    prismaMock.commande.findMany.mockResolvedValueOnce(commandes)
    mockProductionLookup({
      currentStock: -4,
      openCommandes: commandes,
    })

    await expect(service.findAll()).resolves.toEqual([
      {
        ...firstCommande,
        lignes: [
          {
            ...firstCommande.lignes[0],
            productionQuantity: 2,
          },
        ],
      },
      {
        ...secondCommande,
        lignes: [
          {
            ...secondCommande.lignes[0],
            productionQuantity: 2,
          },
        ],
      },
    ])

    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [1],
        },
      },
      select: {
        id: true,
        stock: true,
      },
    })
    expect(prismaMock.commande.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        statut: {
          in: [
            'paiement_en_attente',
            'paiement_a_verifier',
            'nouvelle',
            'preparee',
          ],
        },
        lignes: {
          some: {
            articleId: {
              in: [1],
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
              in: [1],
            },
          },
          select: {
            articleId: true,
            quantite: true,
          },
        },
      },
    })
    expect(prismaMock.mouvementStock.findMany).not.toHaveBeenCalled()
  })

  it.each([
    ['initial deficit', -2, 2],
    ['partial replenishment', -1, 1],
    ['complete replenishment', 0, 0],
    ['overproduction', 4, 0],
  ])(
    'findAll should reconcile production need after %s',
    async (_caseName, currentStock, expectedProductionQuantity) => {
      const commande = makeCommandeForProduction({
        id: 1,
        quantite: 5,
        stock: currentStock,
      })

      prismaMock.commande.findMany.mockResolvedValueOnce([commande])
      mockProductionLookup({
        currentStock,
        openCommandes: [commande],
      })

      await expect(service.findAll()).resolves.toEqual([
        {
          ...commande,
          lignes: [
            {
              ...commande.lignes[0],
              productionQuantity: expectedProductionQuantity,
            },
          ],
        },
      ])
    },
  )

  it('findAll should deterministically allocate stock only once across multiple orders', async () => {
    const laterCreatedSameDueDate = makeCommandeForProduction({
      id: 3,
      quantite: 3,
      stock: -6,
      dateRetrait: new Date('2026-06-18T00:00:00.000Z'),
      createdAt: new Date('2026-06-10T11:00:00.000Z'),
    })
    const earliestDueDate = makeCommandeForProduction({
      id: 1,
      quantite: 4,
      stock: -6,
      dateRetrait: new Date('2026-06-16T00:00:00.000Z'),
      createdAt: new Date('2026-06-10T12:00:00.000Z'),
    })
    const earlierCreatedSameDueDate = makeCommandeForProduction({
      id: 2,
      quantite: 2,
      stock: -6,
      dateRetrait: new Date('2026-06-18T00:00:00.000Z'),
      createdAt: new Date('2026-06-10T10:00:00.000Z'),
    })
    const commandes = [
      laterCreatedSameDueDate,
      earliestDueDate,
      earlierCreatedSameDueDate,
    ]

    prismaMock.commande.findMany.mockResolvedValueOnce(commandes)
    mockProductionLookup({
      currentStock: -6,
      openCommandes: commandes,
    })

    const result = await service.findAll()
    const productionByCommandeId = new Map(
      result.map((commande) => {
        const ligne = commande.lignes[0] as unknown as {
          productionQuantity: number
        }

        return [commande.id, ligne.productionQuantity]
      }),
    )

    expect(productionByCommandeId).toEqual(
      new Map([
        [1, 1],
        [2, 2],
        [3, 3],
      ]),
    )
    expect(
      Array.from(productionByCommandeId.values()).reduce(
        (total, quantity) => total + quantity,
        0,
      ),
    ).toBe(6)
  })

  it.each([['annulee'], ['traitee']])(
    'findAll should exclude %s orders from production allocation',
    async (statut) => {
      const visibleCommande = makeCommandeForProduction({
        id: 1,
        quantite: 5,
        stock: -2,
      })
      const excludedCommande = makeCommandeForProduction({
        id: 2,
        quantite: 5,
        statut,
        stock: -2,
      })

      prismaMock.commande.findMany.mockResolvedValueOnce([
        visibleCommande,
        excludedCommande,
      ])
      mockProductionLookup({
        currentStock: -2,
        openCommandes: [visibleCommande],
      })

      await expect(service.findAll()).resolves.toEqual([
        {
          ...visibleCommande,
          lignes: [
            {
              ...visibleCommande.lignes[0],
              productionQuantity: 2,
            },
          ],
        },
        {
          ...excludedCommande,
          lignes: [
            {
              ...excludedCommande.lignes[0],
              productionQuantity: 0,
            },
          ],
        },
      ])
    },
  )

  it('findAll should account for pending checkout reservations without exposing them as production needs', async () => {
    const pendingCommande = makeCommandeForProduction({
      id: 1,
      quantite: 3,
      statut: 'paiement_en_attente',
      stock: -4,
      dateRetrait: new Date('2026-06-16T00:00:00.000Z'),
    })
    const visibleCommande = makeCommandeForProduction({
      id: 2,
      quantite: 4,
      stock: -4,
      dateRetrait: new Date('2026-06-17T00:00:00.000Z'),
    })

    prismaMock.commande.findMany.mockResolvedValueOnce([
      pendingCommande,
      visibleCommande,
    ])
    mockProductionLookup({
      currentStock: -4,
      openCommandes: [pendingCommande, visibleCommande],
    })

    await expect(service.findAll()).resolves.toEqual([
      {
        ...pendingCommande,
        lignes: [
          {
            ...pendingCommande.lignes[0],
            productionQuantity: 0,
          },
        ],
      },
      {
        ...visibleCommande,
        lignes: [
          {
            ...visibleCommande.lignes[0],
            productionQuantity: 4,
          },
        ],
      },
    ])
  })

  it('findAll should expose production needs for payment review orders', async () => {
    const commande = makeCommandeForProduction({
      id: 1,
      quantite: 5,
      statut: 'paiement_a_verifier',
      stock: -2,
    })

    prismaMock.commande.findMany.mockResolvedValueOnce([commande])
    mockProductionLookup({
      currentStock: -2,
      openCommandes: [commande],
    })

    await expect(service.findAll()).resolves.toEqual([
      {
        ...commande,
        lignes: [
          {
            ...commande.lignes[0],
            productionQuantity: 2,
          },
        ],
      },
    ])
  })

  it('findAll should ignore stale negative stockApres from historical movements after replenishment', async () => {
    const commande = makeCommandeForProduction({
      id: 1,
      quantite: 5,
      stock: 0,
    })

    prismaMock.commande.findMany.mockResolvedValueOnce([commande])
    mockProductionLookup({
      currentStock: 0,
      openCommandes: [commande],
    })
    prismaMock.mouvementStock.findMany.mockResolvedValueOnce([
      {
        articleId: 1,
        quantite: -5,
        stockApres: -2,
        reference: 'commande:1:reservation',
      },
    ])

    await expect(service.findAll()).resolves.toEqual([
      {
        ...commande,
        lignes: [
          {
            ...commande.lignes[0],
            productionQuantity: 0,
          },
        ],
      },
    ])
    expect(prismaMock.mouvementStock.findMany).not.toHaveBeenCalled()
  })

  it('findOne should load details without cleanup side effects', async () => {
    const commande = {
      id: 7,
      statut: 'nouvelle',
      lignes: [],
      historique: [],
    }

    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)

    await expect(service.findOne(7)).resolves.toEqual(commande)

    expect(prismaMock.commande.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 7 },
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
    expect(prismaMock.commande.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(prismaMock.mouvementStock.create).not.toHaveBeenCalled()
  })

  it('findPublicCheckoutSummary should return a safe post-payment summary', async () => {
    const createdAt = new Date('2026-06-05T10:00:00.000Z')
    const dateRetrait = new Date('2026-06-06T00:00:00.000Z')

    prismaMock.commande.findFirst.mockResolvedValue({
      id: 8,
      trackingToken: 'track_token_123',
      totalTtcCents: 1500,
      lieu: validPickupPoint,
      dateRetrait,
      statut: 'nouvelle',
      createdAt,
      lignes: [
        {
          quantite: 2,
          prixUnitCents: 750,
          article: {
            nom: 'Terrine de volaille',
          },
        },
      ],
    })

    await expect(
      service.findPublicCheckoutSummary(' cs_paid '),
    ).resolves.toEqual({
      trackingToken: 'track_token_123',
      reference: 'CMD-000008',
      totalTtcCents: 1500,
      lieu: validPickupPoint,
      dateRetrait: dateRetrait.toISOString(),
      statut: 'nouvelle',
      paiementStatut: 'confirme',
      createdAt: createdAt.toISOString(),
      lignes: [
        {
          nom: 'Terrine de volaille',
          quantite: 2,
          prixUnitCents: 750,
          totalCents: 1500,
        },
      ],
    })

    expect(prismaMock.commande.findFirst).toHaveBeenCalledWith({
      where: { stripeId: 'cs_paid' },
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
  })

  it('findPublicCheckoutSummary should reject an unknown checkout session', async () => {
    prismaMock.commande.findFirst.mockResolvedValue(null)

    await expect(
      service.findPublicCheckoutSummary('cs_unknown'),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('findPublicTrackingSummary should return a safe public order summary', async () => {
    const createdAt = new Date('2026-06-05T10:00:00.000Z')
    const dateRetrait = new Date('2026-06-06T00:00:00.000Z')

    prismaMock.commande.findUnique.mockResolvedValue({
      id: 9,
      trackingToken: 'track_token_valid',
      totalTtcCents: 2250,
      lieu: validPickupPoint,
      dateRetrait,
      statut: 'preparee',
      createdAt,
      lignes: [
        {
          quantite: 3,
          prixUnitCents: 750,
          article: {
            nom: 'Terrine de volaille',
          },
        },
      ],
    })

    const result = await service.findPublicTrackingSummary(
      ' track_token_valid ',
    )

    expect(result).toEqual({
      trackingToken: 'track_token_valid',
      reference: 'CMD-000009',
      totalTtcCents: 2250,
      lieu: validPickupPoint,
      dateRetrait: dateRetrait.toISOString(),
      statut: 'preparee',
      paiementStatut: 'confirme',
      createdAt: createdAt.toISOString(),
      lignes: [
        {
          nom: 'Terrine de volaille',
          quantite: 3,
          prixUnitCents: 750,
          totalCents: 2250,
        },
      ],
    })
    expect(result).not.toHaveProperty('id')
    expect(result).not.toHaveProperty('stripeId')
    expect(result).not.toHaveProperty('email')

    expect(prismaMock.commande.findUnique).toHaveBeenCalledWith({
      where: { trackingToken: 'track_token_valid' },
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
  })

  it('findPublicTrackingSummary should reject an unknown tracking token neutrally', async () => {
    prismaMock.commande.findUnique.mockResolvedValue(null)

    await expect(
      service.findPublicTrackingSummary('unknown_token'),
    ).rejects.toThrow('Commande introuvable ou lien de suivi invalide')
  })

  it('create should aggregate duplicated lines, compute total, decrement stock and record movement', async () => {
    const dto = baseDto({
      lignes: [
        { articleId: 1, quantite: 1 },
        { articleId: 1, quantite: 2 },
      ],
    })

    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 200,
        stock: 8,
      },
    ]

    const created = {
      id: 12,
      totalTtcCents: 600,
      statut: 'nouvelle',
      lignes: [],
    }

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue(created)

    await expect(service.create(dto)).resolves.toEqual(created)

    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [1],
        },
        online: true,
        archivedAt: null,
      },
    })

    expect(prismaMock.commande.create).toHaveBeenCalledWith({
      data: {
        nom: 'Marie Dupont',
        trackingToken: expect.any(String) as string,
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: new Date(validPickupDate),
        totalTtcCents: 600,
        statut: 'nouvelle',
        lignes: {
          create: [
            {
              articleId: 1,
              quantite: 3,
              prixUnitCents: 200,
            },
          ],
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
    expect(
      prismaMock.commande.create.mock.calls[0][0].data.trackingToken,
    ).toMatch(/^[A-Za-z0-9_-]{32}$/)

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          decrement: 3,
        },
      },
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: -3,
      stockAvant: 8,
      stockApres: 5,
      type: 'commande',
      motif: 'Commande en ligne #12',
      reference: 'commande:12',
    })

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 12,
        ancienStatut: null,
        nouveauStatut: 'nouvelle',
        motif: 'creation_directe',
      },
    })
  })

  it('create should allow direct preorder when requested quantity exceeds current stock', async () => {
    const dto = baseDto({
      lignes: [{ articleId: 1, quantite: 5 }],
    })

    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 200,
        stock: 3,
      },
    ]

    const created = {
      id: 99,
      totalTtcCents: 1000,
      statut: 'nouvelle',
      lignes: [],
    }

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue(created)

    await expect(service.create(dto)).resolves.toEqual(created)

    expect(
      mouvementsStockServiceMock.getSellableArticleStock,
    ).not.toHaveBeenCalled()

    expect(prismaMock.commande.create).toHaveBeenCalledWith({
      data: {
        nom: 'Marie Dupont',
        trackingToken: expect.any(String) as string,
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: new Date(validPickupDate),
        totalTtcCents: 1000,
        statut: 'nouvelle',
        lignes: {
          create: [
            {
              articleId: 1,
              quantite: 5,
              prixUnitCents: 200,
            },
          ],
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

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          decrement: 5,
        },
      },
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: -5,
      stockAvant: 3,
      stockApres: -2,
      type: 'commande',
      motif: 'Commande en ligne #99',
      reference: 'commande:99',
    })
  })

  it('create should reject an invalid pickup point before querying articles', async () => {
    pickupPointsServiceMock.validatePickupSlot.mockRejectedValue(
      new BadRequestException('Lieu de retrait invalide'),
    )

    await expect(
      service.create(
        baseDto({
          lieu: 'En boutique',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(prismaMock.article.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('create should reject a pickup date that does not match the pickup point weekday', async () => {
    pickupPointsServiceMock.validatePickupSlot.mockRejectedValue(
      new BadRequestException(
        'La date de retrait ne correspond pas au lieu choisi',
      ),
    )

    await expect(
      service.create(
        baseDto({
          lieu: 'Marché de Gaillon - Mardi matin, 8h-12h',
          dateRetrait: getNextDateForWeekday(3),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(prismaMock.article.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('create should reject unavailable or offline articles', async () => {
    prismaMock.article.findMany.mockResolvedValue([])

    await expect(service.create(baseDto())).rejects.toBeInstanceOf(
      BadRequestException,
    )

    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [1],
        },
        online: true,
        archivedAt: null,
      },
    })

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.commande.create).not.toHaveBeenCalled()
  })

  it('createCheckout should create pending order, reserve stock and create Stripe checkout session', async () => {
    const dto = baseDto({
      lignes: [
        { articleId: 1, quantite: 1 },
        { articleId: 1, quantite: 2 },
      ],
    })

    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 250,
        stock: 10,
        imageUrl: 'https://example.com/baguette.jpg',
      },
    ]

    const pendingCommande = {
      id: 33,
      statut: 'paiement_en_attente',
      totalTtcCents: 750,
      lignes: [],
    }

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue(pendingCommande)
    prismaMock.commande.update.mockResolvedValue({
      ...pendingCommande,
      stripeId: 'cs_test_123',
    })

    await expect(service.createCheckout(dto)).resolves.toEqual({
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })

    expect(Stripe).toHaveBeenCalledWith('sk_test_localco')

    expect(prismaMock.commande.create).toHaveBeenCalledWith({
      data: {
        nom: 'Marie Dupont',
        trackingToken: expect.any(String) as string,
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: new Date(validPickupDate),
        totalTtcCents: 750,
        statut: 'paiement_en_attente',
        lignes: {
          create: [
            {
              articleId: 1,
              quantite: 3,
              prixUnitCents: 250,
            },
          ],
        },
      },
      include: {
        lignes: true,
      },
    })

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          decrement: 3,
        },
      },
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: -3,
      stockAvant: 10,
      stockApres: 7,
      type: 'commande',
      motif: 'Réservation checkout #33',
      reference: 'commande:33:reservation',
    })

    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
      {
        mode: 'payment',
        customer_email: 'marie@example.fr',
        client_reference_id: '33',
        line_items: [
          {
            quantity: 3,
            price_data: {
              currency: 'eur',
              unit_amount: 250,
              product_data: {
                name: 'Baguette',
                images: ['https://example.com/baguette.jpg'],
              },
            },
          },
        ],
        metadata: {
          commandeId: '33',
        },
        success_url:
          'http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/cancel',
      },
      {
        idempotencyKey: 'commande:33:checkout',
      },
    )

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 33 },
      data: { stripeId: 'cs_test_123' },
    })

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 33,
        ancienStatut: null,
        nouveauStatut: 'paiement_en_attente',
        motif: 'checkout_cree',
      },
    })
  })

  it('createCheckout should allow preorder when requested quantity exceeds current stock', async () => {
    const dto = baseDto({
      lignes: [{ articleId: 1, quantite: 5 }],
    })

    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 200,
        stock: 3,
        imageUrl: null,
      },
    ]

    const pendingCommande = {
      id: 44,
      statut: 'paiement_en_attente',
      totalTtcCents: 1000,
      lignes: [],
    }

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue(pendingCommande)
    prismaMock.commande.update.mockResolvedValue({
      ...pendingCommande,
      stripeId: 'cs_test_123',
    })

    await expect(service.createCheckout(dto)).resolves.toEqual({
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })

    expect(
      mouvementsStockServiceMock.getSellableArticleStock,
    ).not.toHaveBeenCalled()

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          decrement: 5,
        },
      },
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: -5,
      stockAvant: 3,
      stockApres: -2,
      type: 'commande',
      motif: 'Réservation checkout #44',
      reference: 'commande:44:reservation',
    })
  })

  it('createCheckout should reject when STRIPE_SECRET_KEY is missing', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return undefined
      if (key === 'SHOP_PUBLIC_URL') return 'http://localhost:3000'
      return undefined
    })

    await expect(service.createCheckout(baseDto())).rejects.toBeInstanceOf(
      BadRequestException,
    )

    expect(prismaMock.article.findMany).not.toHaveBeenCalled()
    expect(prismaMock.commande.create).not.toHaveBeenCalled()
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled()
  })

  it('createCheckout should reject when Stripe session has no URL after reserving stock', async () => {
    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 200,
        stock: 10,
        imageUrl: '/images/baguette.jpg',
      },
    ]

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue({
      id: 45,
      statut: 'paiement_en_attente',
      totalTtcCents: 400,
      lignes: [],
    })
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 45,
      statut: 'paiement_en_attente',
      lignes: [
        {
          articleId: 1,
          quantite: 2,
          article: {
            stock: 8,
          },
        },
      ],
    })
    prismaMock.mouvementStock.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null)
    prismaMock.article.update
      .mockResolvedValueOnce({
        id: 1,
        stock: 8,
      })
      .mockResolvedValueOnce({
        id: 1,
        stock: 10,
      })
    prismaMock.commande.update.mockResolvedValue({
      id: 45,
      statut: 'annulee',
    })
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_without_url',
      url: null,
    })

    await expect(service.createCheckout(baseDto())).rejects.toBeInstanceOf(
      BadRequestException,
    )

    expect(prismaMock.commande.create).toHaveBeenCalled()
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          decrement: 2,
        },
      },
    })
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          increment: 2,
        },
      },
    })
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: 2,
      stockAvant: 8,
      stockApres: 10,
      type: 'commande',
      motif: 'Libération réservation commande #45',
      reference: 'commande:45:reservation:release',
    })
    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 45 },
      data: { statut: 'annulee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 45,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'checkout_session_sans_url',
      },
    })
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('createCheckout should cancel pending order when Stripe session creation throws', async () => {
    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 200,
        stock: 10,
        imageUrl: null,
      },
    ]

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue({
      id: 46,
      statut: 'paiement_en_attente',
      totalTtcCents: 400,
      lignes: [],
    })
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 46,
      statut: 'paiement_en_attente',
      lignes: [
        {
          articleId: 1,
          quantite: 2,
          article: {
            stock: 8,
          },
        },
      ],
    })
    prismaMock.mouvementStock.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null)
    prismaMock.article.update
      .mockResolvedValueOnce({
        id: 1,
        stock: 8,
      })
      .mockResolvedValueOnce({
        id: 1,
        stock: 10,
      })
    prismaMock.commande.update.mockResolvedValue({
      id: 46,
      statut: 'annulee',
    })
    mockStripeCheckoutSessionsCreate.mockRejectedValue(
      new Error('Stripe unavailable'),
    )

    await expect(service.createCheckout(baseDto())).rejects.toBeInstanceOf(
      BadRequestException,
    )

    expect(prismaMock.commande.create).toHaveBeenCalled()
    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 46 },
      data: { statut: 'annulee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: 2,
      stockAvant: 8,
      stockApres: 10,
      type: 'commande',
      motif: 'Libération réservation commande #46',
      reference: 'commande:46:reservation:release',
    })
    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 46,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'checkout_stripe_creation_echec',
      },
    })
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('createCheckout should cancel pending order when Stripe ID update fails', async () => {
    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 200,
        stock: 10,
        imageUrl: null,
      },
    ]

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue({
      id: 47,
      statut: 'paiement_en_attente',
      totalTtcCents: 400,
      lignes: [],
    })
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 47,
      statut: 'paiement_en_attente',
      lignes: [
        {
          articleId: 1,
          quantite: 2,
          article: {
            stock: 8,
          },
        },
      ],
    })
    prismaMock.mouvementStock.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null)
    prismaMock.article.update
      .mockResolvedValueOnce({
        id: 1,
        stock: 8,
      })
      .mockResolvedValueOnce({
        id: 1,
        stock: 10,
      })
    prismaMock.commande.update
      .mockRejectedValueOnce(new Error('Database unavailable'))
      .mockResolvedValueOnce({
        id: 47,
        statut: 'annulee',
      })

    await expect(service.createCheckout(baseDto())).rejects.toBeInstanceOf(
      BadRequestException,
    )

    expect(prismaMock.commande.update).toHaveBeenNthCalledWith(1, {
      where: { id: 47 },
      data: { stripeId: 'cs_test_123' },
    })
    expect(mockStripeCheckoutSessionsExpire).toHaveBeenCalledWith('cs_test_123')
    expect(prismaMock.commande.update).toHaveBeenNthCalledWith(2, {
      where: { id: 47 },
      data: { statut: 'annulee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: 2,
      stockAvant: 8,
      stockApres: 10,
      type: 'commande',
      motif: 'Libération réservation commande #47',
      reference: 'commande:47:reservation:release',
    })
    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 47,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'checkout_stripe_id_update_echec',
      },
    })
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('createCheckout should record reconciliation when unpersisted Stripe session expiration fails', async () => {
    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 200,
        stock: 10,
        online: true,
      },
    ]

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue({
      id: 48,
      statut: 'paiement_en_attente',
      totalTtcCents: 400,
      lignes: [],
    })
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 48,
      statut: 'paiement_en_attente',
      lignes: [
        {
          articleId: 1,
          quantite: 2,
          article: {
            stock: 8,
          },
        },
      ],
    })
    prismaMock.article.update
      .mockResolvedValueOnce({
        id: 1,
        stock: 8,
      })
      .mockResolvedValueOnce({
        id: 1,
        stock: 10,
      })
    prismaMock.commande.update
      .mockRejectedValueOnce(new Error('Database unavailable'))
      .mockResolvedValueOnce({
        id: 48,
        statut: 'annulee',
      })
    mockStripeCheckoutSessionsExpire.mockRejectedValueOnce(
      new Error('Stripe timeout'),
    )

    await expect(service.createCheckout(baseDto())).rejects.toBeInstanceOf(
      BadRequestException,
    )

    expect(mockStripeCheckoutSessionsExpire).toHaveBeenCalledWith('cs_test_123')
    expect(
      transactionClient.$queryRaw.mock.calls.some((call) =>
        call.includes('expire_checkout_session'),
      ),
    ).toBe(true)
    expect(
      transactionClient.$queryRaw.mock.calls.some((call) =>
        call.includes('Stripe timeout'),
      ),
    ).toBe(true)
  })

  it('handleStripeWebhook should reject invalid webhook input', async () => {
    await expect(
      service.handleStripeWebhook(undefined, 'valid-signature'),
    ).rejects.toBeInstanceOf(BadRequestException)

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), undefined),
    ).rejects.toBeInstanceOf(BadRequestException)

    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'STRIPE_WEBHOOK_SECRET') return undefined
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_localco'
      return undefined
    })

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'valid-signature'),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(mockStripeConstructEvent).not.toHaveBeenCalled()
    expect(prismaMock.stripeWebhookEvent.create).not.toHaveBeenCalled()
  })

  it('handleStripeWebhook should reject invalid Stripe signature without side effects', async () => {
    const rawBody = Buffer.from('{}')

    mockStripeConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature')
    })

    await expect(
      service.handleStripeWebhook(rawBody, 'invalid-signature'),
    ).rejects.toBeInstanceOf(BadRequestException)

    expect(mockStripeConstructEvent).toHaveBeenCalledWith(
      rawBody,
      'invalid-signature',
      'whsec_test_localco',
    )
    expect(prismaMock.stripeWebhookEvent.create).not.toHaveBeenCalled()
    expect(prismaMock.commande.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.commande.findMany).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('handleStripeWebhook should return success for an already processed Stripe event without side effects', async () => {
    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_duplicate',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_paid',
        },
      },
    })

    prismaMock.stripeWebhookEvent.create.mockRejectedValueOnce({
      code: 'P2002',
    })
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
      eventId: 'evt_duplicate',
      type: 'checkout.session.completed',
      status: 'processed',
      attempts: 1,
      lastError: null,
      processingStartedAt: new Date('2026-06-10T10:00:00.000Z'),
      processedAt: new Date('2026-06-10T10:00:01.000Z'),
    })

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true, duplicate: true })

    expect(prismaMock.commande.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.commande.findMany).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(prismaMock.commande.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.stripeWebhookEvent.updateMany).not.toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('handleStripeWebhook should process a new completed event and mark it processed', async () => {
    const commande: CommandeMock = {
      id: 55,
      statut: 'paiement_en_attente',
      stripeId: 'cs_paid',
      totalTtcCents: 1250,
      lignes: [
        {
          articleId: 1,
          quantite: 5,
          article: {
            stock: -2,
          },
        },
      ],
    }

    const updatedCommande = {
      ...commande,
      statut: 'nouvelle',
    }

    const rawBody = Buffer.from('{}')

    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_paid',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSessionWebhookObject('cs_paid'),
      },
    })

    prismaMock.commande.findMany.mockResolvedValue([
      { id: commande.id, stripeId: commande.stripeId },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)
    prismaMock.commande.update.mockResolvedValue(updatedCommande)

    await expect(
      service.handleStripeWebhook(rawBody, 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(mockStripeConstructEvent).toHaveBeenCalledWith(
      rawBody,
      'stripe-signature',
      'whsec_test_localco',
    )

    expect(prismaMock.stripeWebhookEvent.create).toHaveBeenCalledWith({
      data: {
        eventId: 'evt_paid',
        type: 'checkout.session.completed',
        status: 'processing',
        attempts: 1,
        lastError: null,
        processingStartedAt: expect.any(Date) as Date,
        processedAt: null,
      },
    })

    expect(prismaMock.commande.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ stripeId: 'cs_paid' }],
      },
      select: { id: true, stripeId: true },
    })

    expect(prismaMock.article.update).not.toHaveBeenCalled()
    expect(
      mouvementsStockServiceMock.getSellableArticleStock,
    ).not.toHaveBeenCalled()
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).not.toHaveBeenCalled()

    expect(transactionClient.$queryRaw).toHaveBeenCalled()
    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { statut: 'nouvelle', stripeId: 'cs_paid' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 55,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'nouvelle',
        motif: 'paiement_confirme',
      },
    })

    expect(emailsServiceMock.sendOrderConfirmation).toHaveBeenCalledWith(
      updatedCommande,
    )
    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'evt_paid',
        status: 'processing',
        processingStartedAt: expect.any(Date) as Date,
      },
      data: {
        status: 'processed',
        processedAt: expect.any(Date) as Date,
        lastError: null,
      },
    })
  })

  it.each([
    [
      'unpaid payment_status',
      checkoutSessionWebhookObject('cs_invalid_payment', {
        payment_status: 'unpaid',
      }),
      'review_checkout_payment_mismatch',
    ],
    [
      'unexpected amount',
      checkoutSessionWebhookObject('cs_invalid_payment', {
        amount_total: 1249,
      }),
      'review_checkout_payment_mismatch',
    ],
    [
      'unexpected currency',
      checkoutSessionWebhookObject('cs_invalid_payment', {
        currency: 'usd',
      }),
      'review_checkout_payment_mismatch',
    ],
    [
      'invalid metadata order id',
      checkoutSessionWebhookObject('cs_invalid_payment', {
        metadata: {
          commandeId: 'not-a-number',
        },
      }),
      'review_checkout_attachment_conflict',
    ],
  ])(
    'handleStripeWebhook should not confirm when checkout session has %s',
    async (_label, sessionObject, expectedOperation) => {
      const commande: CommandeMock = {
        id: 61,
        statut: 'paiement_en_attente',
        stripeId: 'cs_invalid_payment',
        totalTtcCents: 1250,
        lignes: [],
      }

      mockStripeConstructEvent.mockReturnValue({
        id: 'evt_invalid_payment',
        type: 'checkout.session.completed',
        data: {
          object: sessionObject,
        },
      })

      prismaMock.commande.findMany.mockResolvedValue([
        { id: commande.id, stripeId: commande.stripeId },
      ])
      prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)

      await expect(
        service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
      ).resolves.toEqual({ received: true })

      expect(prismaMock.commande.update).not.toHaveBeenCalled()
      expect(prismaMock.commandeStatutHistorique.create).not.toHaveBeenCalled()
      expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
      expect(
        transactionClient.$queryRaw.mock.calls.some((call) =>
          call.includes(expectedOperation),
        ),
      ).toBe(true)
    },
  )

  it('handleStripeWebhook should not confirm when Stripe attachments point to different orders', async () => {
    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_attachment_conflict',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSessionWebhookObject('cs_attachment_conflict', {
          metadata: {
            commandeId: '62',
          },
          client_reference_id: '63',
        }),
      },
    })

    prismaMock.commande.findMany.mockResolvedValue([
      { id: 62, stripeId: 'cs_attachment_conflict' },
      { id: 63, stripeId: null },
    ])

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.commande.findUniqueOrThrow).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(prismaMock.$queryRaw).toHaveBeenCalled()
  })

  it('handleStripeWebhook should not confirm an order in a final incompatible status', async () => {
    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_final_status',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSessionWebhookObject('cs_final_status'),
      },
    })

    prismaMock.commande.findMany.mockResolvedValue([
      { id: 64, stripeId: 'cs_final_status' },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 64,
      statut: 'traitee',
      stripeId: 'cs_final_status',
      totalTtcCents: 1250,
      lignes: [],
    })

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(prismaMock.commandeStatutHistorique.create).not.toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
    expect(transactionClient.$queryRaw).toHaveBeenCalled()
  })

  it('handleStripeWebhook should not confirm an order already cancelled by abandoned cleanup', async () => {
    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_paid_after_cleanup',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSessionWebhookObject('cs_cancelled'),
      },
    })

    prismaMock.commande.findMany.mockResolvedValue([
      { id: 56, stripeId: 'cs_cancelled' },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 56,
      statut: 'annulee',
      stripeId: 'cs_cancelled',
      totalTtcCents: 1250,
      lignes: [],
    })

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.commande.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.commandeStatutHistorique.create).not.toHaveBeenCalled()
    expect(transactionClient.$queryRaw).toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'evt_paid_after_cleanup',
        status: 'processing',
        processingStartedAt: expect.any(Date) as Date,
      },
      data: {
        status: 'processed',
        processedAt: expect.any(Date) as Date,
        lastError: null,
      },
    })
  })

  it('handleStripeWebhook should keep payment confirmation when confirmation email fails', async () => {
    const commande: CommandeMock = {
      id: 56,
      statut: 'paiement_en_attente',
      stripeId: 'cs_paid_email',
      totalTtcCents: 1250,
      lignes: [],
    }
    const updatedCommande = {
      ...commande,
      statut: 'nouvelle',
    }

    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_paid_email',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSessionWebhookObject('cs_paid_email'),
      },
    })

    prismaMock.commande.findMany.mockResolvedValue([
      { id: commande.id, stripeId: commande.stripeId },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)
    prismaMock.commande.update.mockResolvedValue(updatedCommande)
    emailsServiceMock.sendOrderConfirmation.mockRejectedValueOnce(
      new Error('Resend unavailable'),
    )

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 56 },
      data: { statut: 'nouvelle', stripeId: 'cs_paid_email' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'evt_paid_email',
        status: 'processing',
        processingStartedAt: expect.any(Date) as Date,
      },
      data: {
        status: 'processed',
        processedAt: expect.any(Date) as Date,
        lastError: null,
      },
    })
  })

  it('handleStripeWebhook should mark the event failed and rethrow when business processing fails', async () => {
    const databaseError = new Error('database unavailable')

    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_business_failure',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSessionWebhookObject('cs_business_failure'),
      },
    })

    prismaMock.commande.findMany.mockResolvedValue([
      { id: 57, stripeId: 'cs_business_failure' },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 57,
      statut: 'paiement_en_attente',
      stripeId: 'cs_business_failure',
      totalTtcCents: 1250,
      lignes: [],
    })
    prismaMock.commande.update.mockRejectedValueOnce(databaseError)

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).rejects.toThrow(databaseError)

    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'evt_business_failure',
        status: 'processing',
        processingStartedAt: expect.any(Date) as Date,
      },
      data: {
        status: 'failed',
        lastError: 'database unavailable',
        processedAt: null,
      },
    })
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('handleStripeWebhook should retry a failed event and mark it processed after success', async () => {
    const failedAt = new Date('2026-06-10T10:00:00.000Z')
    const commande: CommandeMock = {
      id: 58,
      statut: 'paiement_en_attente',
      stripeId: 'cs_retry',
      totalTtcCents: 1250,
      lignes: [],
    }
    const updatedCommande = {
      ...commande,
      statut: 'nouvelle',
    }

    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_retry',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSessionWebhookObject('cs_retry'),
      },
    })

    prismaMock.stripeWebhookEvent.create.mockRejectedValueOnce({
      code: 'P2002',
    })
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
      eventId: 'evt_retry',
      type: 'checkout.session.completed',
      status: 'failed',
      attempts: 1,
      lastError: 'database unavailable',
      processingStartedAt: failedAt,
      processedAt: null,
    })
    prismaMock.commande.findMany.mockResolvedValue([
      { id: commande.id, stripeId: commande.stripeId },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)
    prismaMock.commande.update.mockResolvedValue(updatedCommande)

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenNthCalledWith(
      1,
      {
        where: {
          eventId: 'evt_retry',
          OR: [
            { status: 'failed' },
            {
              status: 'processing',
              processingStartedAt: {
                lt: expect.any(Date) as Date,
              },
            },
          ],
        },
        data: {
          type: 'checkout.session.completed',
          status: 'processing',
          attempts: {
            increment: 1,
          },
          lastError: null,
          processingStartedAt: expect.any(Date) as Date,
          processedAt: null,
        },
      },
    )
    expect(prismaMock.commande.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenLastCalledWith({
      where: {
        eventId: 'evt_retry',
        status: 'processing',
        processingStartedAt: expect.any(Date) as Date,
      },
      data: {
        status: 'processed',
        processedAt: expect.any(Date) as Date,
        lastError: null,
      },
    })
  })

  it('handleStripeWebhook should reject a concurrent processing event as retryable', async () => {
    let releaseBusinessLookup: (commande: CommandeMock) => void = () => {}
    const businessLookup = new Promise<CommandeMock>((resolve) => {
      releaseBusinessLookup = resolve
    })
    const commande: CommandeMock = {
      id: 59,
      statut: 'paiement_en_attente',
      stripeId: 'cs_concurrent',
      totalTtcCents: 1250,
      lignes: [],
    }
    const updatedCommande = {
      ...commande,
      statut: 'nouvelle',
    }

    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_concurrent',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSessionWebhookObject('cs_concurrent'),
      },
    })

    prismaMock.stripeWebhookEvent.create
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce({ code: 'P2002' })
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
      eventId: 'evt_concurrent',
      type: 'checkout.session.completed',
      status: 'processing',
      attempts: 1,
      lastError: null,
      processingStartedAt: new Date(),
      processedAt: null,
    })
    prismaMock.stripeWebhookEvent.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    prismaMock.commande.findMany.mockReturnValueOnce(
      businessLookup.then((commande) => [
        { id: commande.id, stripeId: commande.stripeId },
      ]),
    )
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)
    prismaMock.commande.update.mockResolvedValue(updatedCommande)

    const firstCall = service.handleStripeWebhook(
      Buffer.from('{}'),
      'stripe-signature',
    )
    const secondCall = service.handleStripeWebhook(
      Buffer.from('{}'),
      'stripe-signature',
    )

    await expect(secondCall).rejects.toBeInstanceOf(ServiceUnavailableException)

    releaseBusinessLookup(commande)

    await expect(firstCall).resolves.toEqual({ received: true })
    expect(prismaMock.commande.update).toHaveBeenCalledTimes(1)
    expect(emailsServiceMock.sendOrderConfirmation).toHaveBeenCalledTimes(1)
  })

  it('handleStripeWebhook should not reclaim a non-stale processing event', async () => {
    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_processing',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_processing',
        },
      },
    })

    prismaMock.stripeWebhookEvent.create.mockRejectedValueOnce({
      code: 'P2002',
    })
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
      eventId: 'evt_processing',
      type: 'checkout.session.completed',
      status: 'processing',
      attempts: 1,
      lastError: null,
      processingStartedAt: new Date(),
      processedAt: null,
    })
    prismaMock.stripeWebhookEvent.updateMany.mockResolvedValueOnce({
      count: 0,
    })

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)

    expect(prismaMock.commande.findFirst).not.toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('handleStripeWebhook should reclaim a stale processing event', async () => {
    const commande: CommandeMock = {
      id: 60,
      statut: 'paiement_en_attente',
      stripeId: 'cs_stale',
      totalTtcCents: 1250,
      lignes: [],
    }
    const updatedCommande = {
      ...commande,
      statut: 'nouvelle',
    }

    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_stale',
      type: 'checkout.session.completed',
      data: {
        object: checkoutSessionWebhookObject('cs_stale'),
      },
    })

    prismaMock.stripeWebhookEvent.create.mockRejectedValueOnce({
      code: 'P2002',
    })
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
      eventId: 'evt_stale',
      type: 'checkout.session.completed',
      status: 'processing',
      attempts: 1,
      lastError: null,
      processingStartedAt: new Date('2026-06-10T10:00:00.000Z'),
      processedAt: null,
    })
    prismaMock.commande.findMany.mockResolvedValue([
      { id: commande.id, stripeId: commande.stripeId },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)
    prismaMock.commande.update.mockResolvedValue(updatedCommande)

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'processing',
          attempts: {
            increment: 1,
          },
          lastError: null,
        }) as unknown,
      }),
    )
    expect(prismaMock.commande.update).toHaveBeenCalledTimes(1)
  })

  it('handleStripeWebhook should not send confirmation email when paid order does not exist', async () => {
    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_unknown_order',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_unknown',
        },
      },
    })

    prismaMock.commande.findFirst.mockResolvedValue(null)

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.article.update).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'evt_unknown_order',
        status: 'processing',
        processingStartedAt: expect.any(Date) as Date,
      },
      data: {
        status: 'processed',
        processedAt: expect.any(Date) as Date,
        lastError: null,
      },
    })
  })

  it('handleStripeWebhook should expire pending order and release reserved stock', async () => {
    const pendingCommande = {
      id: 77,
      statut: 'paiement_en_attente',
      lignes: [
        {
          articleId: 1,
          quantite: 2,
          article: {
            stock: 8,
          },
        },
      ],
    }

    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_expired',
      type: 'checkout.session.expired',
      data: {
        object: {
          id: 'cs_expired',
        },
      },
    })

    prismaMock.commande.findMany.mockResolvedValue([
      { id: 77, stripeId: 'cs_expired' },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(pendingCommande)
    prismaMock.mouvementStock.findFirst.mockResolvedValueOnce({ id: 1 })
    prismaMock.article.update.mockResolvedValue({
      id: 1,
      stock: 10,
    })

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.commande.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ stripeId: 'cs_expired' }],
      },
      select: {
        id: true,
        stripeId: true,
      },
    })

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          increment: 2,
        },
      },
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: 2,
      stockAvant: 8,
      stockApres: 10,
      type: 'commande',
      motif: 'Libération réservation commande #77',
      reference: 'commande:77:reservation:release',
    })

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { statut: 'annulee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 77,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'checkout_expire',
      },
    })
    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'evt_expired',
        status: 'processing',
        processingStartedAt: expect.any(Date) as Date,
      },
      data: {
        status: 'processed',
        processedAt: expect.any(Date) as Date,
        lastError: null,
      },
    })
  })

  it('handleStripeWebhook should mark unhandled valid events as processed', async () => {
    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_unhandled_processed',
      type: 'customer.created',
      data: {
        object: {
          id: 'cus_unused',
        },
      },
    })

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.commande.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.commande.findMany).not.toHaveBeenCalled()
    expect(prismaMock.stripeWebhookEvent.updateMany).toHaveBeenCalledWith({
      where: {
        eventId: 'evt_unhandled_processed',
        status: 'processing',
        processingStartedAt: expect.any(Date) as Date,
      },
      data: {
        status: 'processed',
        processedAt: expect.any(Date) as Date,
        lastError: null,
      },
    })
  })

  it.each<
    [
      string,
      CommandeStatut,
      typeof BadRequestException | typeof ConflictException,
    ]
  >([
    ['annulee', 'preparee', ConflictException],
    ['traitee', 'preparee', ConflictException],
    ['paiement_en_attente', 'preparee', BadRequestException],
    ['paiement_a_verifier', 'preparee', BadRequestException],
  ])(
    'updateStatut should reject transition from %s to %s',
    async (
      currentStatut: string,
      nextStatut: CommandeStatut,
      expectedException: typeof BadRequestException | typeof ConflictException,
    ) => {
      prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
        id: 1,
        statut: currentStatut,
        lignes: [],
      })

      await expect(service.updateStatut(1, nextStatut)).rejects.toBeInstanceOf(
        expectedException,
      )

      expect(prismaMock.commande.update).not.toHaveBeenCalled()
    },
  )

  it('updateStatut should update a non-final commande and record history', async () => {
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 1,
      statut: 'nouvelle',
      lignes: [],
    })

    prismaMock.commande.update.mockResolvedValue({
      id: 1,
      statut: 'preparee',
    })

    await expect(service.updateStatut(1, 'preparee')).resolves.toEqual({
      id: 1,
      statut: 'preparee',
    })

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { statut: 'preparee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 1,
        ancienStatut: 'nouvelle',
        nouveauStatut: 'preparee',
        motif: 'statut_modifie',
      },
    })
  })

  it('updateStatut should release reserved stock when cancelling pending payment', async () => {
    const commande = {
      id: 2,
      statut: 'paiement_en_attente',
      lignes: [
        {
          articleId: 1,
          quantite: 2,
          article: {
            stock: 8,
          },
        },
      ],
    }

    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)
    prismaMock.mouvementStock.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null)
    prismaMock.article.update.mockResolvedValue({
      id: 1,
      stock: 10,
    })
    prismaMock.commande.update.mockResolvedValue({
      ...commande,
      statut: 'annulee',
    })

    await expect(service.updateStatut(2, 'annulee')).resolves.toEqual({
      ...commande,
      statut: 'annulee',
    })

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          increment: 2,
        },
      },
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: 2,
      stockAvant: 8,
      stockApres: 10,
      type: 'commande',
      motif: 'Libération réservation commande #2',
      reference: 'commande:2:reservation:release',
    })

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { statut: 'annulee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 2,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'annulation',
      },
    })
  })

  it('updateStatut should not release reserved stock twice when release movement already exists', async () => {
    const commande = {
      id: 22,
      statut: 'paiement_en_attente',
      lignes: [
        {
          articleId: 1,
          quantite: 2,
          article: {
            stock: 8,
          },
        },
      ],
    }

    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)
    prismaMock.mouvementStock.findFirst.mockResolvedValueOnce({ id: 1 })
    transactionClient.$queryRaw
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce([])
    prismaMock.commande.update.mockResolvedValue({
      ...commande,
      statut: 'annulee',
    })

    await expect(service.updateStatut(22, 'annulee')).resolves.toEqual({
      ...commande,
      statut: 'annulee',
    })

    expect(prismaMock.article.update).not.toHaveBeenCalled()
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 22 },
      data: { statut: 'annulee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
  })

  it('updateStatut should restore stock when cancelling confirmed order', async () => {
    const commande = {
      id: 3,
      statut: 'nouvelle',
      lignes: [
        {
          articleId: 2,
          quantite: 4,
          article: {
            stock: 6,
          },
        },
      ],
    }

    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)

    prismaMock.article.update.mockResolvedValue({
      id: 2,
      stock: 10,
    })

    prismaMock.commande.update.mockResolvedValue({
      ...commande,
      statut: 'annulee',
    })

    await expect(service.updateStatut(3, 'annulee')).resolves.toEqual({
      ...commande,
      statut: 'annulee',
    })

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        stock: {
          increment: 4,
        },
      },
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 2,
      quantite: 4,
      stockAvant: 6,
      stockApres: 10,
      type: 'commande',
      motif: 'Libération réservation commande #3',
      reference: 'commande:3:reservation:release',
    })

    expect(prismaMock.stockLot.create).not.toHaveBeenCalled()

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 3,
        ancienStatut: 'nouvelle',
        nouveauStatut: 'annulee',
        motif: 'annulation',
      },
    })
  })

  const makePendingCleanupCommande = (data: {
    id: number
    statut?: string
    stripeId?: string | null
    createdAt?: Date
  }) => ({
    id: data.id,
    statut: data.statut ?? 'paiement_en_attente',
    stripeId: data.stripeId ?? `cs_cleanup_${data.id}`,
    createdAt: data.createdAt ?? new Date('2026-06-10T08:00:00.000Z'),
    lignes: [
      {
        articleId: 1,
        quantite: 2,
        article: {
          stock: 8,
        },
      },
    ],
  })

  it('cleanupAbandonedCommandes should return an empty summary when no old pending commande exists', async () => {
    prismaMock.commande.findMany.mockResolvedValue([])

    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      scanned: 0,
      cancelled: 0,
      skipped: 0,
      failed: 0,
    })

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(prismaMock.commandeStatutHistorique.create).not.toHaveBeenCalled()
  })

  it('cleanupAbandonedCommandes should lock, release stock and cancel an old pending commande', async () => {
    const commande = makePendingCleanupCommande({ id: 9 })

    prismaMock.commande.findMany.mockResolvedValue([{ id: 9 }])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)

    prismaMock.mouvementStock.findFirst.mockResolvedValueOnce({ id: 1 })

    prismaMock.article.update.mockResolvedValue({
      id: 1,
      stock: 10,
    })

    prismaMock.commande.update.mockResolvedValue({
      id: 9,
      statut: 'annulee',
    })

    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      scanned: 1,
      cancelled: 1,
      skipped: 0,
      failed: 0,
    })

    expect(prismaMock.commande.findMany).toHaveBeenCalledWith({
      where: {
        statut: 'paiement_en_attente',
        createdAt: {
          lt: expect.any(Date) as Date,
        },
      },
      select: {
        id: true,
      },
    })
    expect(transactionClient.$queryRaw).toHaveBeenCalled()
    expect(prismaMock.commande.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 9 },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          increment: 2,
        },
      },
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: 2,
      stockAvant: 8,
      stockApres: 10,
      type: 'commande',
      motif: 'Libération réservation commande #9',
      reference: 'commande:9:reservation:release',
    })

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { statut: 'annulee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 9,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'commande_abandonnee',
      },
    })
  })

  it('cleanupAbandonedCommandes should not select recent pending commandes', async () => {
    prismaMock.commande.findMany.mockResolvedValue([])

    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      scanned: 0,
      cancelled: 0,
      skipped: 0,
      failed: 0,
    })

    expect(prismaMock.commande.findMany).toHaveBeenCalledWith({
      where: {
        statut: 'paiement_en_attente',
        createdAt: {
          lt: expect.any(Date) as Date,
        },
      },
      select: {
        id: true,
      },
    })
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).not.toHaveBeenCalled()
  })

  it.each([['annulee'], ['nouvelle']])(
    'cleanupAbandonedCommandes should skip a commande that became %s before lock processing',
    async (statut) => {
      prismaMock.commande.findMany.mockResolvedValue([{ id: 9 }])
      prismaMock.commande.findUniqueOrThrow.mockResolvedValue(
        makePendingCleanupCommande({ id: 9, statut }),
      )

      await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
        scanned: 1,
        cancelled: 0,
        skipped: 1,
        failed: 0,
      })

      expect(prismaMock.commande.update).not.toHaveBeenCalled()
      expect(prismaMock.commandeStatutHistorique.create).not.toHaveBeenCalled()
      expect(
        mouvementsStockServiceMock.recordArticleMovement,
      ).not.toHaveBeenCalled()
    },
  )

  it('cleanupAbandonedCommandes should cancel without stock movement when the reservation was already released', async () => {
    prismaMock.commande.findMany.mockResolvedValue([{ id: 9 }])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(
      makePendingCleanupCommande({ id: 9 }),
    )
    prismaMock.mouvementStock.findFirst.mockResolvedValueOnce({ id: 10 })
    transactionClient.$queryRaw.mockResolvedValueOnce([]).mockResolvedValue([])

    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      scanned: 1,
      cancelled: 1,
      skipped: 0,
      failed: 0,
    })

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { statut: 'annulee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).not.toHaveBeenCalled()
  })

  it('cleanupAbandonedCommandes should process each commande independently and continue after a failure', async () => {
    prismaMock.commande.findMany.mockResolvedValue([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ])
    prismaMock.commande.findUniqueOrThrow
      .mockResolvedValueOnce(makePendingCleanupCommande({ id: 1 }))
      .mockResolvedValueOnce(makePendingCleanupCommande({ id: 1 }))
      .mockResolvedValueOnce(makePendingCleanupCommande({ id: 2 }))
      .mockResolvedValueOnce(makePendingCleanupCommande({ id: 2 }))
      .mockResolvedValueOnce(
        makePendingCleanupCommande({ id: 3, statut: 'nouvelle' }),
      )
    prismaMock.mouvementStock.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 })
    prismaMock.article.update
      .mockResolvedValueOnce({ id: 1, stock: 10 })
      .mockRejectedValueOnce(
        new Error('stock release failed with a long reason'),
      )

    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      scanned: 3,
      cancelled: 1,
      skipped: 1,
      failed: 1,
      failures: [
        {
          commandeId: 2,
          reason: 'stock release failed with a long reason',
        },
      ],
    })

    expect(prismaMock.commande.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { statut: 'annulee' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(5)
  })

  it('cleanupAbandonedCommandes should not double release stock when called twice for the same commande', async () => {
    prismaMock.commande.findMany
      .mockResolvedValueOnce([{ id: 9 }])
      .mockResolvedValueOnce([{ id: 9 }])
    prismaMock.commande.findUniqueOrThrow
      .mockResolvedValueOnce(makePendingCleanupCommande({ id: 9 }))
      .mockResolvedValueOnce(makePendingCleanupCommande({ id: 9 }))
      .mockResolvedValueOnce(
        makePendingCleanupCommande({ id: 9, statut: 'annulee' }),
      )
    prismaMock.mouvementStock.findFirst.mockResolvedValueOnce({ id: 1 })
    prismaMock.article.update.mockResolvedValue({
      id: 1,
      stock: 10,
    })

    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      scanned: 1,
      cancelled: 1,
      skipped: 0,
      failed: 0,
    })
    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      scanned: 1,
      cancelled: 0,
      skipped: 1,
      failed: 0,
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledTimes(1)
    expect(prismaMock.commande.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['45', 45],
    [undefined, 60],
    ['0', 60],
    ['-5', 60],
    ['not-a-number', 60],
  ])(
    'cleanupAbandonedCommandes should use configured abandoned delay %s',
    async (configuredValue, expectedDelayMinutes) => {
      const now = new Date('2026-06-11T12:00:00.000Z').getTime()
      jest.spyOn(Date, 'now').mockReturnValue(now)
      configServiceMock.get.mockImplementation((key: string) => {
        if (key === 'ABANDONED_ORDER_DELAY_MINUTES') {
          return configuredValue
        }
        return undefined
      })

      const configuredService = new CommandesService(
        prismaMock as never,
        mouvementsStockServiceMock as never,
        configServiceMock as never,
        emailsServiceMock as never,
        new StripeCheckoutGateway(configServiceMock as never),
        pickupPointsServiceMock as never,
        new CommandePreparationService(
          prismaMock as never,
          pickupPointsServiceMock as never,
        ),
        new CommandeProductionNeedsService(prismaMock as never),
        new CommandePublicSummaryService(),
        new CommandeStatusHistoryService(),
        new CommandeStockReservationService(
          mouvementsStockServiceMock as never,
        ),
      )

      prismaMock.commande.findMany.mockResolvedValue([])

      await configuredService.cleanupAbandonedCommandes()

      expect(prismaMock.commande.findMany).toHaveBeenCalledWith({
        where: {
          statut: 'paiement_en_attente',
          createdAt: {
            lt: new Date(now - expectedDelayMinutes * 60 * 1000),
          },
        },
        select: {
          id: true,
        },
      })

      jest.restoreAllMocks()
    },
  )
})

function getNextDateForWeekday(targetWeekday: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)

  do {
    date.setDate(date.getDate() + 1)
  } while (date.getDay() !== targetWeekday)

  return formatDateInput(date)
}

function formatDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
