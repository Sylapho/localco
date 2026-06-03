import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { EmailsService } from '../emails/emails.service'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PrismaService } from '../prisma/prisma.service'
import { CommandesService } from './commandes.service'
import { CreateCommandeDto } from './dto/create-commande.dto'

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
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  const mouvementsStockServiceMock = {
    recordArticleMovement: jest.fn(),
    getSellableArticleStock: jest.fn(),
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
          useValue: {
            get: jest.fn(),
          },
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
      <T>(callback: TransactionCallback<T>) => callback(transactionClient),
    )
    prismaMock.commande.findMany.mockResolvedValue([])
    mouvementsStockServiceMock.recordArticleMovement.mockResolvedValue({
      id: 1,
    })
    mouvementsStockServiceMock.getSellableArticleStock.mockImplementation(
      (articles: { id: number; stock: number }[]) =>
        new Map(articles.map((article) => [article.id, article.stock])),
    )
    emailsServiceMock.sendOrderConfirmation.mockResolvedValue(undefined)
  })

  it('findAll should return commandes ordered by date desc', async () => {
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
      select: {
        id: true,
        statut: true,
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

  it('create should aggregate lines, decrement stock and create movements', async () => {
    const body: CreateCommandeDto = {
      nom: 'Marie Dupont',
      email: 'marie@example.fr',
      tel: '0612345678',
      lieu: 'En boutique',
      dateRetrait: '2026-06-01',
      lignes: [
        { articleId: 1, quantite: 1 },
        { articleId: 1, quantite: 2 },
      ],
    }
    const articles = [
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

    await expect(service.create(body)).resolves.toEqual(created)

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
        lieu: 'En boutique',
        dateRetrait: new Date('2026-06-01'),
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

  it('create should reject insufficient stock', async () => {
    prismaMock.article.findMany.mockResolvedValue([
      {
        id: 1,
        nom: 'Baguette',
        prix: 2,
        stock: 1,
      },
    ])

    await expect(
      service.create({
        nom: 'Marie Dupont',
        email: 'marie@example.fr',
        lieu: 'En boutique',
        lignes: [{ articleId: 1, quantite: 2 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('updateStatut should update a non-final commande', async () => {
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

  it('updateStatut should restore stock when cancelling', async () => {
    const commande = {
      id: 1,
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

    await expect(service.updateStatut(1, 'annulee')).resolves.toEqual({
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
      motif: 'Annulation commande #1',
      reference: 'commande:1:annulation',
    })
    expect(prismaMock.commandeStatutHistorique.create).toHaveBeenCalledWith({
      data: {
        commandeId: 1,
        ancienStatut: 'nouvelle',
        nouveauStatut: 'annulee',
        motif: 'annulation',
      },
    })
  })

  it('cleanupAbandonedCommandes should cancel old pending commandes', async () => {
    prismaMock.commande.findMany.mockResolvedValue([
      {
        id: 9,
        statut: 'paiement_en_attente',
      },
    ])
    prismaMock.commande.update.mockResolvedValue({
      id: 9,
      statut: 'annulee',
    })

    await expect(service.cleanupAbandonedCommandes()).resolves.toEqual({
      count: 1,
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
