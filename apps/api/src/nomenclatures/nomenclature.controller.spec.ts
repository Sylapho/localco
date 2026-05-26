import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { NomenclatureController } from './nomenclature.controller'
import { NomenclatureService } from './nomenclature.service'

describe('NomenclatureController', () => {
  let controller: NomenclatureController

  const nomenclatureServiceMock = {
    findByArticle: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NomenclatureController],
      providers: [
        {
          provide: NomenclatureService,
          useValue: nomenclatureServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile()

    controller = module.get<NomenclatureController>(NomenclatureController)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('findByArticle should return article nomenclature', async () => {
    const result = [{ articleId: 1, mpId: 2, quantite: 0.5 }]
    nomenclatureServiceMock.findByArticle.mockResolvedValue(result)

    await expect(controller.findByArticle(1)).resolves.toEqual(result)
    expect(nomenclatureServiceMock.findByArticle).toHaveBeenCalledWith(1)
  })

  it('create should return created nomenclature line', async () => {
    const body = { mpId: 2, quantite: 0.5 }
    const result = { articleId: 1, ...body }

    nomenclatureServiceMock.create.mockResolvedValue(result)

    await expect(controller.create(1, body)).resolves.toEqual(result)
    expect(nomenclatureServiceMock.create).toHaveBeenCalledWith(1, body)
  })

  it('update should return updated nomenclature line', async () => {
    const body = { quantite: 0.75 }
    const result = { articleId: 1, mpId: 2, quantite: 0.75 }

    nomenclatureServiceMock.update.mockResolvedValue(result)

    await expect(controller.update(1, 2, body)).resolves.toEqual(result)
    expect(nomenclatureServiceMock.update).toHaveBeenCalledWith(1, 2, body)
  })

  it('remove should return deleted nomenclature line', async () => {
    const result = { articleId: 1, mpId: 2, quantite: 0.5 }
    nomenclatureServiceMock.remove.mockResolvedValue(result)

    await expect(controller.remove(1, 2)).resolves.toEqual(result)
    expect(nomenclatureServiceMock.remove).toHaveBeenCalledWith(1, 2)
  })
})
