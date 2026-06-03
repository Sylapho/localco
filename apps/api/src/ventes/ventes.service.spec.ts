import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PrismaService } from '../prisma/prisma.service'
import { CreateVenteDto } from './dto/create-vente.dto'
import { VentesService } from './ventes.service'

describe('VentesService', () => {
  let service: VentesService

  const prismaMock = {
    article: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    vente: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  const mouvementsStockServiceMock = {
    recordArticleMovement: jest.fn(),
    getSellableArticleStock: jest.fn(),
  }

  type TransactionClient = {
    article: typeof prismaMock.article
    vente: typeof prismaMock.vente
  }

  type TransactionCallback<T> = (tx: TransactionClient) => Promise<T>

  const transactionClient: TransactionClient = {
    article: prismaMock.article,
    vente: prismaMock.vente,
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VentesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: MouvementsStockService,
          useValue: mouvementsStockServiceMock,
        },
      ],
    }).compile()

    service = module.get<VentesService>(VentesService)
    jest.clearAllMocks()

    prismaMock.$transaction.mockImplementation(
      <T>(callback: TransactionCallback<T>) => callback(transactionClient),
    )
    mouvementsStockServiceMock.recordArticleMovement.mockResolvedValue({
      id: 1,
    })
    mouvementsStockServiceMock.getSellableArticleStock.mockImplementation(
      (articles: { id: number; stock: number }[]) =>
        new Map(articles.map((article) => [article.id, article.stock])),
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('findAll should return ventes ordered by date desc', async () => {
    const ventes = [
      {
        id: 1,
        mode: 'cb',
        totalTTC: 12,
        lignes: [],
      },
    ]

    prismaMock.vente.findMany.mockResolvedValue(ventes)

    await expect(service.findAll()).resolves.toEqual(ventes)
    expect(prismaMock.vente.findMany).toHaveBeenCalledWith({
      include: {
        user: true,
        lignes: {
          include: {
            article: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    })
  })

  it('findOne should return one vente with lines and user', async () => {
    const vente = {
      id: 1,
      mode: 'especes',
      totalTTC: 8,
      lignes: [],
      user: null,
    }

    prismaMock.vente.findUniqueOrThrow.mockResolvedValue(vente)

    await expect(service.findOne(1)).resolves.toEqual(vente)
    expect(prismaMock.vente.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        user: true,
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
  })

  it('create should calculate totals, create lines and decrement article stock', async () => {
    const body: CreateVenteDto = {
      mode: 'cb',
      remise: 1,
      lignes: [
        { articleId: 1, quantite: 2 },
        { articleId: 2, quantite: 1 },
      ],
    }

    const articles = [
      {
        id: 1,
        nom: 'Baguette',
        prix: 2.1,
        tva: 0.055,
        stock: 5,
      },
      {
        id: 2,
        nom: 'Croissant',
        prix: 1.5,
        tva: 0.2,
        stock: 3,
      },
    ]

    const created = {
      id: 10,
      mode: 'cb',
      remise: 1,
      totalTTC: 4.7,
      totalHT: 4.313315872619938,
      tva: 0.38668412738006186,
      lignes: [],
    }

    prismaMock.article.findMany.mockResolvedValue(articles)
    prismaMock.vente.create.mockResolvedValue(created)

    await expect(service.create(body)).resolves.toEqual(created)

    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: [1, 2],
        },
      },
    })
    expect(prismaMock.article.update).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: {
        stock: {
          decrement: 2,
        },
      },
    })
    expect(prismaMock.article.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: {
        stock: {
          decrement: 1,
        },
      },
    })
    expect(prismaMock.vente.create).toHaveBeenCalledWith({
      data: {
        mode: 'cb',
        remise: 1,
        totalTTC: 4.7,
        totalHT: 4.313315872619938,
        tva: 0.38668412738006186,
        userId: undefined,
        lignes: {
          create: [
            {
              articleId: 1,
              quantite: 2,
              prixUnit: 2.1,
              tva: 0.055,
            },
            {
              articleId: 2,
              quantite: 1,
              prixUnit: 1.5,
              tva: 0.2,
            },
          ],
        },
      },
      include: {
        user: true,
        lignes: {
          include: {
            article: true,
          },
        },
      },
    })
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenNthCalledWith(1, transactionClient, {
      articleId: 1,
      quantite: -2,
      stockAvant: 5,
      stockApres: 3,
      type: 'vente',
      motif: 'Vente #10',
      reference: 'vente:10',
      createdByUserId: undefined,
    })
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenNthCalledWith(2, transactionClient, {
      articleId: 2,
      quantite: -1,
      stockAvant: 3,
      stockApres: 2,
      type: 'vente',
      motif: 'Vente #10',
      reference: 'vente:10',
      createdByUserId: undefined,
    })
  })

  it('create should reject an empty vente', async () => {
    const body: CreateVenteDto = {
      mode: 'cb',
      lignes: [],
    }

    await expect(service.create(body)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prismaMock.article.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('create should reject unknown articles', async () => {
    const body: CreateVenteDto = {
      mode: 'cb',
      lignes: [{ articleId: 1, quantite: 1 }],
    }

    prismaMock.article.findMany.mockResolvedValue([])

    await expect(service.create(body)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('create should reject insufficient stock', async () => {
    const body: CreateVenteDto = {
      mode: 'especes',
      lignes: [{ articleId: 1, quantite: 6 }],
    }

    prismaMock.article.findMany.mockResolvedValue([
      {
        id: 1,
        nom: 'Baguette',
        prix: 2.1,
        tva: 0.055,
        stock: 5,
      },
    ])

    await expect(service.create(body)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
