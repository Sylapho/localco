import { Test, TestingModule } from '@nestjs/testing'
import { ArticlesService } from './articles.service'
import { PrismaService } from '../prisma/prisma.service'

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
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile()

    service = module.get<ArticlesService>(ArticlesService)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('findAll should return articles', async () => {
    const articles = [
      { id: 1, nom: 'Baguette', prix: 1.2 },
      { id: 2, nom: 'Croissant', prix: 1.1 },
    ]

    prismaMock.article.findMany.mockResolvedValue(articles)

    await expect(service.findAll()).resolves.toEqual(articles)
    expect(prismaMock.article.findMany).toHaveBeenCalled()
  })

  it('findOne should return one article', async () => {
    const article = { id: 1, nom: 'Baguette', prix: 1.2 }

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
    const input = {
      nom: 'Pain au chocolat',
      prix: 1.5,
    }

    const created = {
      id: 1,
      nom: 'Pain au chocolat',
      prix: 1.5,
      tva: 0.055,
      stock: 0,
      online: true,
      emoji: '🥖',
    }

    prismaMock.article.create.mockResolvedValue(created)

    await expect(service.create(input as any)).resolves.toEqual(created)
    expect(prismaMock.article.create).toHaveBeenCalledWith({
      data: {
        nom: 'Pain au chocolat',
        prix: 1.5,
        tva: 0.055,
        stock: 0,
        online: true,
        emoji: '🥖',
        description: undefined,
      },
    })
  })

  it('update should update an article', async () => {
    const updated = {
      id: 1,
      nom: 'Baguette tradition',
      prix: 1.3,
    }

    prismaMock.article.update.mockResolvedValue(updated)

    await expect(service.update(1, { prix: 1.3 })).resolves.toEqual(updated)
    expect(prismaMock.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { prix: 1.3 },
    })
  })

  it('remove should delete an article', async () => {
    const deleted = { id: 1, nom: 'Baguette', prix: 1.2 }

    prismaMock.article.delete.mockResolvedValue(deleted)

    await expect(service.remove(1)).resolves.toEqual(deleted)
    expect(prismaMock.article.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
  })
})