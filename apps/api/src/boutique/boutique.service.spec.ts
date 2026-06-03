import { Test, TestingModule } from '@nestjs/testing'
import { PrismaService } from '../prisma/prisma.service'
import { BoutiqueService } from './boutique.service'

describe('BoutiqueService', () => {
  let service: BoutiqueService

  const prismaMock = {
    article: {
      findMany: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BoutiqueService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile()

    service = module.get<BoutiqueService>(BoutiqueService)
    jest.clearAllMocks()
  })

  it('findOnlineArticles should return online articles ordered by name', async () => {
    const articles = [{ id: 1, nom: 'Baguette', online: true }]
    prismaMock.article.findMany.mockResolvedValue(articles)

    await expect(service.findOnlineArticles()).resolves.toEqual(articles)
    expect(prismaMock.article.findMany).toHaveBeenCalledWith({
      where: {
        online: true,
      },
      orderBy: {
        nom: 'asc',
      },
    })
  })
})
