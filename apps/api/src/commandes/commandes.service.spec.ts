import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import Stripe from 'stripe'
import { EmailsService } from '../emails/emails.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PrismaService } from '../prisma/prisma.service'
import { CommandesService } from './commandes.service'
import { CreateCommandeDto } from './dto/create-commande.dto'
import { CommandeStatut } from './dto/update-commande-statut.dto'

const mockStripeCheckoutSessionsCreate = jest.fn()
const mockStripeConstructEvent = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockStripeCheckoutSessionsCreate,
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
  prix: number
  stock: number
  online?: boolean
  imageUrl?: string | null
}

type CommandeLigneMock = {
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
  totalTTC?: number
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
      create: jest.fn(),
    },
    stripeWebhookEvent: {
      create: jest.fn(),
    },
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

  type TransactionClient = {
    article: typeof prismaMock.article
    commande: typeof prismaMock.commande
    commandeStatutHistorique: typeof prismaMock.commandeStatutHistorique
    mouvementStock: typeof prismaMock.mouvementStock
  }

  type TransactionCallback<T> = (tx: TransactionClient) => Promise<T>

  const transactionClient: TransactionClient = {
    article: prismaMock.article,
    commande: prismaMock.commande,
    commandeStatutHistorique: prismaMock.commandeStatutHistorique,
    mouvementStock: prismaMock.mouvementStock,
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommandesService,
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
    }).compile()

    service = module.get<CommandesService>(CommandesService)

    jest.clearAllMocks()

    prismaMock.$transaction.mockImplementation(
      async <T>(callback: TransactionCallback<T>) =>
        callback(transactionClient),
    )

    prismaMock.commande.findMany.mockResolvedValue([])
    prismaMock.commandeStatutHistorique.create.mockResolvedValue({ id: 1 })
    prismaMock.mouvementStock.findFirst.mockResolvedValue(null)
    prismaMock.mouvementStock.create.mockResolvedValue({ id: 1 })
    prismaMock.stripeWebhookEvent.create.mockResolvedValue({ id: 1 })

    mouvementsStockServiceMock.recordArticleMovement.mockResolvedValue({
      id: 1,
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

    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
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

  it('findAll should cleanup abandoned commandes before listing visible commandes', async () => {
    const commandes = [{ id: 1, statut: 'nouvelle' }]

    prismaMock.commande.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(commandes)

    await expect(service.findAll()).resolves.toEqual(commandes)

    expect(prismaMock.commande.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        statut: 'paiement_en_attente',
        createdAt: {
          lt: expect.any(Date) as Date,
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

    expect(prismaMock.commande.findMany).toHaveBeenNthCalledWith(2, {
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
  })

  it('findOne should cleanup abandoned commandes before loading details', async () => {
    const commande = {
      id: 7,
      statut: 'nouvelle',
      lignes: [],
      historique: [],
    }

    prismaMock.commande.findMany.mockResolvedValueOnce([])
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
  })

  it('findPublicCheckoutSummary should return a safe post-payment summary', async () => {
    const createdAt = new Date('2026-06-05T10:00:00.000Z')
    const dateRetrait = new Date('2026-06-06T00:00:00.000Z')

    prismaMock.commande.findFirst.mockResolvedValue({
      id: 8,
      totalTTC: 15,
      lieu: validPickupPoint,
      dateRetrait,
      statut: 'nouvelle',
      createdAt,
      lignes: [
        {
          quantite: 2,
          prixUnit: 7.5,
          article: {
            nom: 'Terrine de volaille',
          },
        },
      ],
    })

    await expect(
      service.findPublicCheckoutSummary(' cs_paid '),
    ).resolves.toEqual({
      id: 8,
      reference: 'CMD-000008',
      totalTTC: 15,
      lieu: validPickupPoint,
      dateRetrait: dateRetrait.toISOString(),
      statut: 'nouvelle',
      paiementStatut: 'confirme',
      createdAt: createdAt.toISOString(),
      lignes: [
        {
          nom: 'Terrine de volaille',
          quantite: 2,
          prixUnit: 7.5,
          total: 15,
        },
      ],
    })

    expect(prismaMock.commande.findFirst).toHaveBeenCalledWith({
      where: { stripeId: 'cs_paid' },
      select: {
        id: true,
        totalTTC: true,
        lieu: true,
        dateRetrait: true,
        statut: true,
        createdAt: true,
        lignes: {
          select: {
            quantite: true,
            prixUnit: true,
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
        prix: 2,
        stock: 8,
      },
    ]

    const created = {
      id: 12,
      totalTTC: 6,
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
      },
    })

    expect(prismaMock.commande.create).toHaveBeenCalledWith({
      data: {
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: new Date(validPickupDate),
        totalTTC: 6,
        statut: 'nouvelle',
        lignes: {
          create: [
            {
              articleId: 1,
              quantite: 3,
              prixUnit: 2,
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

  it('create should accept order even when stock becomes negative', async () => {
    const dto = baseDto({
      lignes: [{ articleId: 1, quantite: 5 }],
    })

    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prix: 2,
        stock: 3,
      },
    ]

    const created = {
      id: 99,
      totalTTC: 10,
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
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: new Date(validPickupDate),
        totalTTC: 10,
        statut: 'nouvelle',
        lignes: {
          create: [
            {
              articleId: 1,
              quantite: 5,
              prixUnit: 2,
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
        prix: 2.5,
        stock: 10,
        imageUrl: 'https://example.com/baguette.jpg',
      },
    ]

    const pendingCommande = {
      id: 33,
      statut: 'paiement_en_attente',
      totalTTC: 7.5,
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
        email: 'marie@example.fr',
        tel: '0612345678',
        lieu: validPickupPoint,
        dateRetrait: new Date(validPickupDate),
        totalTTC: 7.5,
        statut: 'paiement_en_attente',
        lignes: {
          create: [
            {
              articleId: 1,
              quantite: 3,
              prixUnit: 2.5,
            },
          ],
        },
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

  it('createCheckout should accept and reserve stock even when stock becomes negative', async () => {
    const dto = baseDto({
      lignes: [{ articleId: 1, quantite: 5 }],
    })

    const articles: ArticleMock[] = [
      {
        id: 1,
        nom: 'Baguette',
        prix: 2,
        stock: 3,
        imageUrl: null,
      },
    ]

    const pendingCommande = {
      id: 44,
      statut: 'paiement_en_attente',
      totalTTC: 10,
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
        prix: 2,
        stock: 10,
        imageUrl: '/images/baguette.jpg',
      },
    ]

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.commande.create.mockResolvedValue({
      id: 45,
      statut: 'paiement_en_attente',
      totalTTC: 4,
      lignes: [],
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
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
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

  it('handleStripeWebhook should ignore duplicate Stripe events', async () => {
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

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true, duplicate: true })

    expect(prismaMock.commande.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(emailsServiceMock.sendOrderConfirmation).not.toHaveBeenCalled()
  })

  it('handleStripeWebhook should confirm paid order without rechecking stock or decrementing again', async () => {
    const commande: CommandeMock = {
      id: 55,
      statut: 'paiement_en_attente',
      stripeId: 'cs_paid',
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
        object: {
          id: 'cs_paid',
        },
      },
    })

    prismaMock.commande.findFirst.mockResolvedValue(commande)
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
      },
    })

    expect(prismaMock.commande.findFirst).toHaveBeenCalledWith({
      where: { stripeId: 'cs_paid' },
      include: {
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })

    expect(prismaMock.article.update).not.toHaveBeenCalled()
    expect(
      mouvementsStockServiceMock.getSellableArticleStock,
    ).not.toHaveBeenCalled()
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).not.toHaveBeenCalled()

    expect(prismaMock.commande.update).toHaveBeenCalledWith({
      where: { id: 55 },
      data: { statut: 'nouvelle' },
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

    prismaMock.commande.findMany.mockResolvedValue([pendingCommande])
    prismaMock.mouvementStock.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null)
    prismaMock.article.update.mockResolvedValue({
      id: 1,
      stock: 10,
    })

    await expect(
      service.handleStripeWebhook(Buffer.from('{}'), 'stripe-signature'),
    ).resolves.toEqual({ received: true })

    expect(prismaMock.commande.findMany).toHaveBeenCalledWith({
      where: {
        stripeId: 'cs_expired',
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
    })

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 77,
        ancienStatut: 'paiement_en_attente',
        nouveauStatut: 'annulee',
        motif: 'checkout_expire',
      },
    })
  })

  it.each([
    ['annulee', 'preparee'],
    ['traitee', 'preparee'],
    ['paiement_en_attente', 'preparee'],
    ['paiement_a_verifier', 'preparee'],
  ])(
    'updateStatut should reject transition from %s to %s',
    async (currentStatut: string, nextStatut: CommandeStatut) => {
      prismaMock.commande.findUniqueOrThrow.mockResolvedValue({
        id: 1,
        statut: currentStatut,
        lignes: [],
      })

      await expect(service.updateStatut(1, nextStatut)).rejects.toBeInstanceOf(
        BadRequestException,
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
    prismaMock.mouvementStock.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 })
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
      motif: 'Annulation commande #3',
      reference: 'commande:3:annulation',
    })

    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 3,
        ancienStatut: 'nouvelle',
        nouveauStatut: 'annulee',
        motif: 'annulation',
      },
    })
  })

  it('cleanupAbandonedCommandes should return count 0 when no old pending commande exists', async () => {
    prismaMock.commande.findMany.mockResolvedValue([])

    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      count: 0,
    })

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.commande.update).not.toHaveBeenCalled()
    expect(prismaMock.commandeStatutHistorique.create).not.toHaveBeenCalled()
  })

  it('cleanupAbandonedCommandes should release reserved stock before cancelling old pending commandes', async () => {
    prismaMock.commande.findMany.mockResolvedValue([
      {
        id: 9,
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
      },
    ])

    prismaMock.mouvementStock.findFirst
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce(null)

    prismaMock.article.update.mockResolvedValue({
      id: 1,
      stock: 10,
    })

    prismaMock.commande.update.mockResolvedValue({
      id: 9,
      statut: 'annulee',
    })

    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      count: 1,
    })

    expect(prismaMock.commande.findMany).toHaveBeenCalledWith({
      where: {
        statut: 'paiement_en_attente',
        createdAt: {
          lt: expect.any(Date) as Date,
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
