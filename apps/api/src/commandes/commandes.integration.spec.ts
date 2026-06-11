import { INestApplication, ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import express, { Request } from 'express'
import request from 'supertest'
import Stripe from 'stripe'
import { EmailsService } from '../emails/emails.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PrismaService } from '../prisma/prisma.service'
import { CommandesController } from './commandes.controller'
import { CommandesService } from './commandes.service'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { StripeCheckoutGateway } from './stripe-checkout.gateway'

const mockStripeCheckoutSessionsCreate = jest.fn()
const mockStripeCheckoutSessionsExpire = jest.fn()
const mockStripeConstructEvent = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockStripeCheckoutSessionsCreate,
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

type TransactionClient = {
  $queryRaw: jest.Mock
  article: {
    findMany: jest.Mock
    update: jest.Mock
  }
  commande: {
    findMany: jest.Mock
    findFirst: jest.Mock
    findUniqueOrThrow: jest.Mock
    create: jest.Mock
    update: jest.Mock
    updateMany: jest.Mock
  }
  commandeStatutHistorique: {
    create: jest.Mock
  }
  mouvementStock: {
    findFirst: jest.Mock
    findMany: jest.Mock
    create: jest.Mock
  }
  stockLot: {
    aggregate: jest.Mock
    create: jest.Mock
  }
}

type TransactionCallback<T> = (tx: TransactionClient) => Promise<T>

type ErrorResponseBody = {
  statusCode: number
}

describe('Commandes integration', () => {
  let app: INestApplication

  const prismaMock = {
    article: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    commande: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    commandeStatutHistorique: {
      create: jest.fn(),
    },
    mouvementStock: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    stockLot: {
      aggregate: jest.fn(),
      create: jest.fn(),
    },
    stripeWebhookEvent: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  }

  const transactionClient: TransactionClient = {
    $queryRaw: prismaMock.$queryRaw,
    article: prismaMock.article,
    commande: prismaMock.commande,
    commandeStatutHistorique: prismaMock.commandeStatutHistorique,
    mouvementStock: prismaMock.mouvementStock,
    stockLot: prismaMock.stockLot,
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

  const validPickupPoint = 'Marché de Gaillon - Mardi matin, 8h-12h'
  const validPickupDate = getNextDateForWeekday(2)

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [CommandesController],
      providers: [
        CommandesService,
        StripeCheckoutGateway,
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
      ],
    })

    const moduleFixture: TestingModule = await moduleBuilder
      .overrideGuard(BetterAuthGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: jest.fn(() => true),
      })
      .compile()

    app = moduleFixture.createNestApplication()

    app.use(
      express.json({
        verify: (req, _res, buffer) => {
          ;(req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer)
        },
      }),
    )

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )

    app.setGlobalPrefix('api')

    await app.init()

    jest.clearAllMocks()
    ;[
      prismaMock.article.findMany,
      prismaMock.article.update,
      prismaMock.commande.findMany,
      prismaMock.commande.findFirst,
      prismaMock.commande.findUniqueOrThrow,
      prismaMock.commande.create,
      prismaMock.commande.update,
      prismaMock.commande.updateMany,
      prismaMock.commandeStatutHistorique.create,
      prismaMock.mouvementStock.findFirst,
      prismaMock.mouvementStock.findMany,
      prismaMock.mouvementStock.create,
      prismaMock.stockLot.aggregate,
      prismaMock.stockLot.create,
      prismaMock.stripeWebhookEvent.create,
      prismaMock.stripeWebhookEvent.findUnique,
      prismaMock.stripeWebhookEvent.updateMany,
      prismaMock.$queryRaw,
      prismaMock.$transaction,
      mouvementsStockServiceMock.recordArticleMovement,
      mouvementsStockServiceMock.getSellableArticleStock,
      configServiceMock.get,
      emailsServiceMock.sendOrderConfirmation,
      mockStripeCheckoutSessionsCreate,
      mockStripeCheckoutSessionsExpire,
      mockStripeConstructEvent,
    ].forEach((mock) => mock.mockReset())

    prismaMock.$transaction.mockImplementation(
      async <T>(callback: TransactionCallback<T>) =>
        callback(transactionClient),
    )
    prismaMock.$queryRaw.mockResolvedValue([{ id: 1 }])

    prismaMock.commande.findMany.mockResolvedValue([])
    prismaMock.commande.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.commandeStatutHistorique.create.mockResolvedValue({ id: 1 })
    prismaMock.mouvementStock.findFirst.mockResolvedValue(null)
    prismaMock.mouvementStock.findMany.mockResolvedValue([])
    prismaMock.mouvementStock.create.mockResolvedValue({ id: 1 })
    prismaMock.stockLot.aggregate.mockResolvedValue({
      _sum: {
        remainingQuantity: 0,
      },
    })
    prismaMock.stockLot.create.mockResolvedValue({ id: 1 })
    prismaMock.stripeWebhookEvent.create.mockResolvedValue({ id: 1 })
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.stripeWebhookEvent.updateMany.mockResolvedValue({ count: 1 })

    mouvementsStockServiceMock.recordArticleMovement.mockResolvedValue({
      id: 1,
    })

    mouvementsStockServiceMock.getSellableArticleStock.mockResolvedValue(
      new Map(),
    )

    configServiceMock.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        DATABASE_URL:
          'postgresql://localco:localco@localhost:5432/localco_test',
        STRIPE_SECRET_KEY: 'sk_test_localco',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_localco',
        SHOP_PUBLIC_URL: 'http://localhost:3000',
      }

      return values[key]
    })

    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })
    mockStripeCheckoutSessionsExpire.mockResolvedValue({ id: 'cs_test_123' })

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

  afterEach(async () => {
    if (app) {
      await app.close()
    }
  })

  it('GET /api/commandes/pickup-points should expose public pickup choices used by checkout validation', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/commandes/pickup-points')
      .expect(200)

    expect(response.body).toEqual(
      expect.arrayContaining([
        {
          label: 'Marché de Gaillon',
          schedule: 'Mardi matin, 8h-12h',
          allowedWeekdays: [2],
          value: validPickupPoint,
        },
      ]),
    )
  })

  it('POST /api/commandes should create a direct order and allow negative stock', async () => {
    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 200,
        stock: 3,
      },
    ]

    const createdCommande = {
      id: 101,
      statut: 'nouvelle',
      totalTtcCents: 1000,
      lignes: [],
    }

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue(createdCommande)

    const response = await request(app.getHttpServer())
      .post('/api/commandes')
      .send({
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: validPickupDate,
        lignes: [{ articleId: 1, quantite: 5 }],
      })
      .expect(201)

    expect(response.body).toEqual(createdCommande)

    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [1],
        },
        online: true,
      },
    })

    expect(prismaMock.commande.create).toHaveBeenCalledWith({
      data: {
        nom: 'Marie Dupont',
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
      motif: 'Commande en ligne #101',
      reference: 'commande:101',
    })
  })

  it('POST /api/commandes should reject invalid DTO payload before service writes anything', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/commandes')
      .send({
        nom: 'Marie Dupont',
        email: 'not-an-email',
        lieu: validPickupPoint,
        dateRetrait: validPickupDate,
        lignes: [{ articleId: 1, quantite: 0 }],
        unexpectedField: true,
      })
      .expect(400)

    const body = response.body as unknown as ErrorResponseBody

    expect(body.statusCode).toBe(400)
    expect(prismaMock.article.findMany).not.toHaveBeenCalled()
    expect(prismaMock.commande.create).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('POST /api/commandes should reject an invalid pickup slot before querying articles', async () => {
    await request(app.getHttpServer())
      .post('/api/commandes')
      .send({
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: 'Marché de Gaillon - Mardi matin, 8h-12h',
        dateRetrait: getNextDateForWeekday(3),
        lignes: [{ articleId: 1, quantite: 1 }],
      })
      .expect(400)

    expect(prismaMock.article.findMany).not.toHaveBeenCalled()
    expect(prismaMock.commande.create).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('POST /api/commandes should reject unavailable or offline articles', async () => {
    prismaMock.article.findMany.mockResolvedValue([])

    await request(app.getHttpServer())
      .post('/api/commandes')
      .send({
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: validPickupDate,
        lignes: [{ articleId: 1, quantite: 1 }],
      })
      .expect(400)

    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [1],
        },
        online: true,
      },
    })

    expect(prismaMock.commande.create).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('POST /api/commandes/checkout should create pending order, reserve stock, and return Stripe checkout URL', async () => {
    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 250,
        stock: 3,
        imageUrl: 'https://example.com/baguette.jpg',
      },
    ]

    const pendingCommande = {
      id: 202,
      statut: 'paiement_en_attente',
      totalTtcCents: 1250,
      lignes: [],
    }

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue(pendingCommande)
    prismaMock.commande.update.mockResolvedValue({
      ...pendingCommande,
      stripeId: 'cs_test_123',
    })

    const response = await request(app.getHttpServer())
      .post('/api/commandes/checkout')
      .send({
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: validPickupDate,
        lignes: [{ articleId: 1, quantite: 5 }],
      })
      .expect(201)

    expect(response.body).toEqual({
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    })

    expect(Stripe).toHaveBeenCalledWith('sk_test_localco')

    expect(prismaMock.commande.create).toHaveBeenCalledWith({
      data: {
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: new Date(validPickupDate),
        totalTtcCents: 1250,
        statut: 'paiement_en_attente',
        lignes: {
          create: [
            {
              articleId: 1,
              quantite: 5,
              prixUnitCents: 250,
            },
          ],
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
      motif: 'Réservation checkout #202',
      reference: 'commande:202:reservation',
    })

    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledWith(
      {
        mode: 'payment',
        customer_email: 'marie@example.fr',
        client_reference_id: '202',
        line_items: [
          {
            quantity: 5,
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
          commandeId: '202',
        },
        success_url:
          'http://localhost:3000/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/cancel',
      },
      {
        idempotencyKey: 'commande:202:checkout',
      },
    )

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 202 },
      data: { stripeId: 'cs_test_123' },
    })
  })

  it('POST /api/commandes/checkout then signed completed webhook should confirm once and ignore duplicate event', async () => {
    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 250,
        stock: 3,
        imageUrl: null,
      },
    ]
    const pendingCommande = {
      id: 220,
      statut: 'paiement_en_attente',
      totalTtcCents: 1250,
      lignes: [],
    }
    const pendingCommandeWithLines = {
      ...pendingCommande,
      stripeId: 'cs_test_critical',
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
    const confirmedCommande = {
      ...pendingCommandeWithLines,
      statut: 'nouvelle',
    }
    const completedEvent = {
      id: 'evt_checkout_completed_critical',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_critical',
          payment_status: 'paid',
          amount_total: 1250,
          currency: 'eur',
        },
      },
    }
    const webhookPayload = {
      id: completedEvent.id,
      type: completedEvent.type,
      data: completedEvent.data,
    }
    const signedWebhookHeader = 't=1710000000,v1=mock_signature'

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue(pendingCommande)
    prismaMock.commande.update
      .mockResolvedValueOnce({
        ...pendingCommande,
        stripeId: 'cs_test_critical',
      })
      .mockResolvedValueOnce(confirmedCommande)
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(
      pendingCommandeWithLines,
    )
    prismaMock.commande.findMany.mockResolvedValue([
      {
        id: pendingCommandeWithLines.id,
        stripeId: pendingCommandeWithLines.stripeId,
      },
    ])
    prismaMock.stripeWebhookEvent.create
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce({ code: 'P2002' })
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValueOnce({
      eventId: 'evt_checkout_completed_critical',
      type: 'checkout.session.completed',
      status: 'processed',
      attempts: 1,
      lastError: null,
      processingStartedAt: new Date(),
      processedAt: new Date(),
    })
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_critical',
      url: 'https://checkout.stripe.com/pay/cs_test_critical',
    })
    mockStripeConstructEvent.mockReturnValue(completedEvent)

    const checkoutResponse = await request(app.getHttpServer())
      .post('/api/commandes/checkout')
      .send({
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: validPickupDate,
        lignes: [{ articleId: 1, quantite: 5 }],
      })
      .expect(201)

    expect(checkoutResponse.body).toEqual({
      url: 'https://checkout.stripe.com/pay/cs_test_critical',
    })
    expect(prismaMock.commande.create).toHaveBeenCalledWith({
      data: {
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: new Date(validPickupDate),
        totalTtcCents: 1250,
        statut: 'paiement_en_attente',
        lignes: {
          create: [
            {
              articleId: 1,
              quantite: 5,
              prixUnitCents: 250,
            },
          ],
        },
      },
    })
    expect(prismaMock.article.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          decrement: 5,
        },
      },
    })

    const firstWebhookResponse = await request(app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', signedWebhookHeader)
      .send(webhookPayload)
      .expect(201)

    expect(firstWebhookResponse.body).toEqual({
      received: true,
    })
    expect(mockStripeConstructEvent).toHaveBeenCalledWith(
      expect.any(Buffer),
      signedWebhookHeader,
      'whsec_test_localco',
    )
    expect(prismaMock.stripeWebhookEvent.create).toHaveBeenCalledWith({
      data: {
        eventId: 'evt_checkout_completed_critical',
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
        OR: [{ stripeId: 'cs_test_critical' }],
      },
      select: { id: true, stripeId: true },
    })
    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 220 },
      data: { statut: 'nouvelle', stripeId: 'cs_test_critical' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
    expect(prismaMock.article.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 220,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'nouvelle',
        motif: 'paiement_confirme',
      },
    })
    expect(emailsServiceMock.sendOrderConfirmation).toHaveBeenCalledWith(
      confirmedCommande,
    )

    const duplicateWebhookResponse = await request(app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', signedWebhookHeader)
      .send(webhookPayload)
      .expect(201)

    expect(duplicateWebhookResponse.body).toEqual({
      received: true,
      duplicate: true,
    })
    expect(mockStripeConstructEvent).toHaveBeenCalledTimes(2)
    expect(prismaMock.stripeWebhookEvent.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.commande.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.commande.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.article.update).toHaveBeenCalledTimes(1)
    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledTimes(2)
    expect(emailsServiceMock.sendOrderConfirmation).toHaveBeenCalledTimes(1)
  })

  it('POST /api/commandes/checkout should reject when STRIPE_SECRET_KEY is missing', async () => {
    configServiceMock.get.mockImplementation((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return undefined
      if (key === 'SHOP_PUBLIC_URL') return 'http://localhost:3000'
      return undefined
    })

    await request(app.getHttpServer())
      .post('/api/commandes/checkout')
      .send({
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: validPickupDate,
        lignes: [{ articleId: 1, quantite: 1 }],
      })
      .expect(400)

    expect(prismaMock.article.findMany).not.toHaveBeenCalled()
    expect(prismaMock.commande.create).not.toHaveBeenCalled()
    expect(mockStripeCheckoutSessionsCreate).not.toHaveBeenCalled()
  })

  it('POST /api/commandes/checkout should cancel pending order when Stripe returns no URL', async () => {
    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 250,
        stock: 3,
        imageUrl: null,
      },
    ]

    const pendingCommande = {
      id: 203,
      statut: 'paiement_en_attente',
      totalTtcCents: 1250,
      lignes: [],
    }

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue(pendingCommande)
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 203,
      statut: 'paiement_en_attente',
      lignes: [
        {
          articleId: 1,
          quantite: 5,
          article: {
            stock: -2,
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
        stock: -2,
      })
      .mockResolvedValueOnce({
        id: 1,
        stock: 3,
      })
    prismaMock.commande.update.mockResolvedValue({
      ...pendingCommande,
      statut: 'annulee',
    })
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_without_url',
      url: null,
    })

    const response = await request(app.getHttpServer())
      .post('/api/commandes/checkout')
      .send({
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: validPickupDate,
        lignes: [{ articleId: 1, quantite: 5 }],
      })
      .expect(400)

    const body = response.body as unknown as ErrorResponseBody

    expect(body.statusCode).toBe(400)
    expect(prismaMock.commande.create).toHaveBeenCalled()
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          decrement: 5,
        },
      },
    })
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          increment: 5,
        },
      },
    })
    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 203 },
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
        commandeId: 203,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'checkout_session_sans_url',
      },
    })
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('POST /api/commandes/checkout should cancel pending order when Stripe session creation throws', async () => {
    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prixCents: 250,
        stock: 3,
        imageUrl: null,
      },
    ]
    const pendingCommande = {
      id: 204,
      statut: 'paiement_en_attente',
      totalTtcCents: 1250,
      lignes: [],
    }

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue(pendingCommande)
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
      id: 204,
      statut: 'paiement_en_attente',
      lignes: [
        {
          articleId: 1,
          quantite: 5,
          article: {
            stock: -2,
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
        stock: -2,
      })
      .mockResolvedValueOnce({
        id: 1,
        stock: 3,
      })
    prismaMock.commande.update.mockResolvedValue({
      ...pendingCommande,
      statut: 'annulee',
    })
    mockStripeCheckoutSessionsCreate.mockRejectedValue(
      new Error('Stripe unavailable'),
    )

    const response = await request(app.getHttpServer())
      .post('/api/commandes/checkout')
      .send({
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: validPickupDate,
        lignes: [{ articleId: 1, quantite: 5 }],
      })
      .expect(400)

    const body = response.body as unknown as ErrorResponseBody

    expect(body.statusCode).toBe(400)
    expect(prismaMock.commande.create).toHaveBeenCalled()
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          decrement: 5,
        },
      },
    })
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          increment: 5,
        },
      },
    })
    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 204 },
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
        commandeId: 204,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'checkout_stripe_creation_echec',
      },
    })
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('GET /api/commandes/checkout-session/:sessionId should return public order summary', async () => {
    const createdAt = new Date('2026-06-05T10:00:00.000Z')
    const dateRetrait = new Date('2026-06-09T00:00:00.000Z')

    prismaMock.commande.findFirst.mockResolvedValue({
      id: 505,
      totalTtcCents: 1250,
      lieu: validPickupPoint,
      dateRetrait,
      statut: 'nouvelle',
      createdAt,
      lignes: [
        {
          quantite: 5,
          prixUnitCents: 250,
          article: {
            nom: 'Baguette',
          },
        },
      ],
    })

    const response = await request(app.getHttpServer())
      .get('/api/commandes/checkout-session/cs_paid')
      .expect(200)

    expect(response.body).toEqual({
      id: 505,
      reference: 'CMD-000505',
      totalTtcCents: 1250,
      lieu: validPickupPoint,
      dateRetrait: dateRetrait.toISOString(),
      statut: 'nouvelle',
      paiementStatut: 'confirme',
      createdAt: createdAt.toISOString(),
      lignes: [
        {
          nom: 'Baguette',
          quantite: 5,
          prixUnitCents: 250,
          totalCents: 1250,
        },
      ],
    })

    expect(prismaMock.commande.findFirst).toHaveBeenCalledWith({
      where: { stripeId: 'cs_paid' },
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
  })

  it('GET /api/commandes/checkout-session/:sessionId should return 404 for unknown order', async () => {
    prismaMock.commande.findFirst.mockResolvedValue(null)

    await request(app.getHttpServer())
      .get('/api/commandes/checkout-session/cs_unknown')
      .expect(404)
  })

  it('POST /api/commandes/stripe/webhook should reject missing Stripe signature', async () => {
    await request(app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .send({})
      .expect(400)

    expect(mockStripeConstructEvent).not.toHaveBeenCalled()
    expect(prismaMock.stripeWebhookEvent.create).not.toHaveBeenCalled()
  })

  it('POST /api/commandes/stripe/webhook should reject invalid Stripe signature', async () => {
    mockStripeConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature')
    })

    await request(app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', 'invalid-signature')
      .send({})
      .expect(400)

    expect(mockStripeConstructEvent).toHaveBeenCalledWith(
      expect.any(Buffer),
      'invalid-signature',
      'whsec_test_localco',
    )
    expect(prismaMock.stripeWebhookEvent.create).not.toHaveBeenCalled()
    expect(prismaMock.commande.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.commande.findMany).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('POST /api/commandes/stripe/webhook should ignore duplicate Stripe events', async () => {
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
      processingStartedAt: new Date(),
      processedAt: new Date(),
    })

    const response = await request(app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', 'stripe-signature')
      .send({})
      .expect(201)

    expect(response.body).toEqual({
      received: true,
      duplicate: true,
    })

    expect(prismaMock.commande.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(prismaMock.commande.updateMany).not.toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('POST /api/commandes/stripe/webhook should confirm paid order without decrementing stock again', async () => {
    const commande = {
      id: 303,
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

    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_paid',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_paid',
          payment_status: 'paid',
          amount_total: 1250,
          currency: 'eur',
        },
      },
    })

    prismaMock.commande.findMany.mockResolvedValue([
      { id: commande.id, stripeId: commande.stripeId },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(commande)
    prismaMock.commande.update.mockResolvedValue(updatedCommande)

    const response = await request(app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', 'stripe-signature')
      .send({})
      .expect(201)

    expect(response.body).toEqual({
      received: true,
    })

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
      mouvementsStockServiceMock.recordArticleMovement,
    ).not.toHaveBeenCalled()

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 303 },
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
        commandeId: 303,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'nouvelle',
        motif: 'paiement_confirme',
      },
    })

    expect(emailsServiceMock.sendOrderConfirmation).toHaveBeenCalledWith(
      updatedCommande,
    )
  })

  it('POST /api/commandes/stripe/webhook should ignore completed event for unknown session safely', async () => {
    mockStripeConstructEvent.mockReturnValue({
      id: 'evt_unknown_session',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_unknown',
        },
      },
    })

    prismaMock.commande.findFirst.mockResolvedValue(null)

    const response = await request(app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', 'stripe-signature')
      .send({})
      .expect(201)

    expect(response.body).toEqual({
      received: true,
    })
    expect(prismaMock.commande.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ stripeId: 'cs_unknown' }],
      },
      select: { id: true, stripeId: true },
    })
    expect(prismaMock.article.update).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(prismaMock.commande.updateMany).not.toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('POST /api/commandes/stripe/webhook should expire pending checkout and release reserved stock', async () => {
    const pendingCommande = {
      id: 404,
      statut: 'paiement_en_attente',
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
      { id: 404, stripeId: 'cs_expired' },
    ])
    prismaMock.commande.findUniqueOrThrow.mockResolvedValue(pendingCommande)
    prismaMock.mouvementStock.findFirst.mockResolvedValueOnce({ id: 1 })
    prismaMock.article.update.mockResolvedValue({
      id: 1,
      stock: 3,
    })

    const response = await request(app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', 'stripe-signature')
      .send({})
      .expect(201)

    expect(response.body).toEqual({
      received: true,
    })

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
          increment: 5,
        },
      },
    })

    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: 5,
      stockAvant: -2,
      stockApres: 3,
      type: 'commande',
      motif: 'Libération réservation commande #404',
      reference: 'commande:404:reservation:release',
    })

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 404 },
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
        commandeId: 404,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'checkout_expire',
      },
    })
  })
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
