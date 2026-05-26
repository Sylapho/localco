import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { ArticlesController } from './articles.controller'
import { ArticlesService } from './articles.service'

describe('ArticlesController', () => {
  let controller: ArticlesController

  const articlesServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getProductionCapacity: jest.fn(),
    produce: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        {
          provide: ArticlesService,
          useValue: articlesServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile()

    controller = module.get<ArticlesController>(ArticlesController)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('findAll should return articles', async () => {
    const result = [{ id: 1, nom: 'Baguette' }]
    articlesServiceMock.findAll.mockResolvedValue(result)

    await expect(controller.findAll()).resolves.toEqual(result)
  })

  it('findOne should return one article', async () => {
    const result = { id: 1, nom: 'Baguette' }
    articlesServiceMock.findOne.mockResolvedValue(result)

    await expect(controller.findOne(1)).resolves.toEqual(result)
  })

  it('create should return created article', async () => {
    const body = { nom: 'Croissant', prix: 1.1 }
    const result = { id: 2, ...body }

    articlesServiceMock.create.mockResolvedValue(result)

    await expect(controller.create(body as any)).resolves.toEqual(result)
  })

  it('update should return updated article', async () => {
    const body = { prix: 1.3 }
    const result = { id: 1, nom: 'Baguette', prix: 1.3 }

    articlesServiceMock.update.mockResolvedValue(result)

    await expect(controller.update(1, body as any)).resolves.toEqual(result)
  })

  it('remove should return deleted article', async () => {
    const result = { id: 1, nom: 'Baguette' }

    articlesServiceMock.remove.mockResolvedValue(result)

    await expect(controller.remove(1)).resolves.toEqual(result)
  })

  it('getProductionCapacity should return article capacity', async () => {
    const result = {
      articleId: 1,
      articleNom: 'Baguette',
      capacite: 10,
      limitingIngredient: null,
      ingredients: [],
    }

    articlesServiceMock.getProductionCapacity.mockResolvedValue(result)

    await expect(controller.getProductionCapacity(1)).resolves.toEqual(result)
    expect(articlesServiceMock.getProductionCapacity).toHaveBeenCalledWith(1)
  })

  it('produce should return production result', async () => {
    const result = {
      article: { id: 1, nom: 'Baguette' },
      produced: 2,
      consumed: [],
    }

    articlesServiceMock.produce.mockResolvedValue(result)

    await expect(controller.produce(1, { quantite: 2 })).resolves.toEqual(
      result,
    )
    expect(articlesServiceMock.produce).toHaveBeenCalledWith(1, 2)
  })
})
