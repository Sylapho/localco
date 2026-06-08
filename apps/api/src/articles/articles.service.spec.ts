import { BadRequestException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { MouvementsStockService } from '../mouvements-stock/mouvements-stock.service'
import { PrismaService } from '../prisma/prisma.service'
import { ArticlesService } from './articles.service'
import { CreateArticleDto } from './dto/create-article.dto'

describe('ArticlesService', () => {
  let service: ArticlesService

  const prismaMock = {
    article: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    matierePremiere: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  const mouvementsStockServiceMock = {
    recordArticleMovement: jest.fn(),
    recordMatierePremiereMovement: jest.fn(),
    getSellableMatiereStock: jest.fn(),
  }

  type TransactionClient = {
    article: typeof prismaMock.article
    matierePremiere: typeof prismaMock.matierePremiere
  }

  type TransactionCallback<T> = (tx: TransactionClient) => Promise<T>

  const transactionClient: TransactionClient = {
    article: prismaMock.article,
    matierePremiere: prismaMock.matierePremiere,
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
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

    service = module.get<ArticlesService>(ArticlesService)
    jest.clearAllMocks()

    prismaMock.$transaction.mockImplementation(
      <T>(callback: TransactionCallback<T>) => callback(transactionClient),
    )
    mouvementsStockServiceMock.recordArticleMovement.mockResolvedValue({
      id: 1,
    })
    mouvementsStockServiceMock.recordMatierePremiereMovement.mockResolvedValue({
      id: 2,
    })
    mouvementsStockServiceMock.getSellableMatiereStock.mockImplementation(
      (matieres: { id: number; stock: number }[]) =>
        new Map(matieres.map((matiere) => [matiere.id, matiere.stock])),
    )
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('findAll should return articles', async () => {
    const articles = [
      { id: 1, nom: 'Baguette', prixCents: 120 },
      { id: 2, nom: 'Croissant', prixCents: 110 },
    ]

    prismaMock.article.findMany.mockResolvedValue(articles)

    await expect(service.findAll()).resolves.toEqual(articles)
    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      include: {
        nomen: {
          include: {
            mp: true,
          },
        },
      },
      orderBy: {
        nom: 'asc',
      },
    })
  })

  it('findOne should return one article', async () => {
    const article = { id: 1, nom: 'Baguette', prixCents: 120 }

    prismaMock.article.findUniqueOrThrow.mockResolvedValue(article)

    await expect(service.findOne(1)).resolves.toEqual(article)
    expect(prismaMock.article.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        nomen: {
          include: {
            mp: true,
          },
        },
      },
    })
  })

  it('create should create an article with defaults', async () => {
    const input: CreateArticleDto = {
      nom: 'Pain au chocolat',
      prixCents: 150,
    }

    const created = {
      id: 1,
      nom: 'Pain au chocolat',
      prixCents: 150,
      tvaBps: 550,
      stock: 0,
      online: true,
      imageUrl: null,
    }

    prismaMock.article.create.mockResolvedValue(created)

    await expect(service.create(input)).resolves.toEqual(created)
    expect(prismaMock.article.create).toHaveBeenCalledWith({
      data: {
        nom: 'Pain au chocolat',
        prixCents: 150,
        tvaBps: 550,
        stock: 0,
        online: true,
        description: undefined,
        ingredients: undefined,
        allergenes: undefined,
        imageUrl: undefined,
      },
    })
  })

  it('update should update an article', async () => {
    const updated = {
      id: 1,
      nom: 'Baguette tradition',
      prixCents: 130,
    }

    prismaMock.article.update.mockResolvedValue(updated)

    await expect(service.update(1, { prixCents: 130 })).resolves.toEqual(
      updated,
    )
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { prixCents: 130 },
    })
  })

  it('remove should delete an article', async () => {
    const deleted = { id: 1, nom: 'Baguette', prixCents: 120 }

    prismaMock.article.delete.mockResolvedValue(deleted)

    await expect(service.remove(1)).resolves.toEqual(deleted)
    expect(prismaMock.article.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })

  it('getProductionCapacity should return zero without nomenclature', async () => {
    const article = {
      id: 1,
      nom: 'Baguette',
      nomen: [],
    }

    prismaMock.article.findUniqueOrThrow.mockResolvedValue(article)

    await expect(service.getProductionCapacity(1)).resolves.toEqual({
      articleId: 1,
      articleNom: 'Baguette',
      capacite: 0,
      limitingIngredient: null,
      ingredients: [],
    })
  })

  it('getProductionCapacity should calculate the limiting ingredient', async () => {
    const article = {
      id: 1,
      nom: 'Baguette',
      stock: 1,
      nomen: [
        {
          mpId: 1,
          quantite: 0.5,
          mp: {
            id: 1,
            nom: 'Farine',
            stock: 10,
            unite: 'kg',
          },
        },
        {
          mpId: 2,
          quantite: 0.1,
          mp: {
            id: 2,
            nom: 'Levure',
            stock: 1,
            unite: 'kg',
          },
        },
      ],
    }

    prismaMock.article.findUniqueOrThrow.mockResolvedValue(article)

    await expect(service.getProductionCapacity(1)).resolves.toEqual({
      articleId: 1,
      articleNom: 'Baguette',
      capacite: 10,
      limitingIngredient: {
        mpId: 2,
        nom: 'Levure',
        stock: 1,
        sellableStock: 1,
        unite: 'kg',
        quantiteNecessaire: 0.1,
        possible: 10,
      },
      ingredients: [
        {
          mpId: 1,
          nom: 'Farine',
          stock: 10,
          sellableStock: 10,
          unite: 'kg',
          quantiteNecessaire: 0.5,
          possible: 20,
        },
        {
          mpId: 2,
          nom: 'Levure',
          stock: 1,
          sellableStock: 1,
          unite: 'kg',
          quantiteNecessaire: 0.1,
          possible: 10,
        },
      ],
    })
  })

  it('produce should reject an article without nomenclature', async () => {
    prismaMock.article.findUniqueOrThrow.mockResolvedValue({
      id: 1,
      nom: 'Baguette',
      nomen: [],
    })

    await expect(service.produce(1, { quantite: 2 })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('produce should reject insufficient ingredients', async () => {
    prismaMock.article.findUniqueOrThrow.mockResolvedValue({
      id: 1,
      nom: 'Baguette',
      nomen: [
        {
          mpId: 1,
          quantite: 0.5,
          mp: {
            id: 1,
            nom: 'Farine',
            stock: 0.8,
            unite: 'kg',
          },
        },
      ],
    })

    await expect(service.produce(1, { quantite: 2 })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it('produce should decrement ingredients and increment article stock', async () => {
    const article = {
      id: 1,
      nom: 'Baguette',
      stock: 1,
      nomen: [
        {
          mpId: 1,
          quantite: 0.5,
          mp: {
            id: 1,
            nom: 'Farine',
            stock: 10,
            unite: 'kg',
          },
        },
        {
          mpId: 2,
          quantite: 0.1,
          mp: {
            id: 2,
            nom: 'Levure',
            stock: 2,
            unite: 'kg',
          },
        },
      ],
    }
    const updatedArticle = {
      ...article,
      stock: 4,
    }

    prismaMock.article.findUniqueOrThrow.mockResolvedValue(article)
    prismaMock.article.update.mockResolvedValue(updatedArticle)

    await expect(service.produce(1, { quantite: 3 })).resolves.toEqual({
      article: updatedArticle,
      produced: 3,
      consumed: [
        {
          mpId: 1,
          nom: 'Farine',
          unite: 'kg',
          quantite: 1.5,
        },
        {
          mpId: 2,
          nom: 'Levure',
          unite: 'kg',
          quantite: 0.30000000000000004,
        },
      ],
    })
    expect(prismaMock.matierePremiere.update).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: {
        stock: {
          decrement: 1.5,
        },
      },
    })
    expect(prismaMock.matierePremiere.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: {
        stock: {
          decrement: 0.30000000000000004,
        },
      },
    })
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: {
          increment: 3,
        },
      },
      include: {
        nomen: {
          include: {
            mp: true,
          },
        },
      },
    })
    expect(
      mouvementsStockServiceMock.recordMatierePremiereMovement,
    ).toHaveBeenNthCalledWith(1, transactionClient, {
      mpId: 1,
      quantite: -1.5,
      stockAvant: 10,
      stockApres: 8.5,
      type: 'production',
      motif: 'Production de 3 Baguette',
      reference: 'production:article:1',
    })
    expect(
      mouvementsStockServiceMock.recordMatierePremiereMovement,
    ).toHaveBeenNthCalledWith(2, transactionClient, {
      mpId: 2,
      quantite: -0.30000000000000004,
      stockAvant: 2,
      stockApres: 1.7,
      type: 'production',
      motif: 'Production de 3 Baguette',
      reference: 'production:article:1',
    })
    expect(
      mouvementsStockServiceMock.recordArticleMovement,
    ).toHaveBeenCalledWith(transactionClient, {
      articleId: 1,
      quantite: 3,
      stockAvant: 1,
      stockApres: 4,
      type: 'production',
      motif: 'Production de 3 Baguette',
      reference: 'production:article:1',
    })
  })
})
