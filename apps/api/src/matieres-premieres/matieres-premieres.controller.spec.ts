import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { MatieresPremieresController } from './matieres-premieres.controller'
import { MatieresPremieresService } from './matieres-premieres.service'

describe('MatieresPremieresController', () => {
  let controller: MatieresPremieresController

  const matieresPremieresServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatieresPremieresController],
      providers: [
        {
          provide: MatieresPremieresService,
          useValue: matieresPremieresServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile()

    controller = module.get<MatieresPremieresController>(
      MatieresPremieresController,
    )
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('findAll should return matieres premieres', async () => {
    const result = [{ id: 1, nom: 'Farine' }]
    matieresPremieresServiceMock.findAll.mockResolvedValue(result)

    await expect(controller.findAll()).resolves.toEqual(result)
    expect(matieresPremieresServiceMock.findAll).toHaveBeenCalled()
  })

  it('findOne should return one matiere premiere', async () => {
    const result = { id: 1, nom: 'Farine' }
    matieresPremieresServiceMock.findOne.mockResolvedValue(result)

    await expect(controller.findOne(1)).resolves.toEqual(result)
    expect(matieresPremieresServiceMock.findOne).toHaveBeenCalledWith(1)
  })

  it('create should return created matiere premiere', async () => {
    const body = {
      nom: 'Farine',
      stock: 10,
      unite: 'kg',
      coutUnitaireCents: 120,
      seuil: 2,
      conditionnement: 'sac',
    }
    const result = { id: 1, ...body }

    matieresPremieresServiceMock.create.mockResolvedValue(result)

    await expect(controller.create(body)).resolves.toEqual(result)
    expect(matieresPremieresServiceMock.create).toHaveBeenCalledWith(body)
  })

  it('update should return updated matiere premiere', async () => {
    const body = { nom: 'Farine T65' }
    const result = { id: 1, nom: 'Farine T65' }

    matieresPremieresServiceMock.update.mockResolvedValue(result)

    await expect(controller.update(1, body)).resolves.toEqual(result)
    expect(matieresPremieresServiceMock.update).toHaveBeenCalledWith(1, body)
  })

  it('remove should return deleted matiere premiere', async () => {
    const result = { id: 1, nom: 'Farine' }
    matieresPremieresServiceMock.remove.mockResolvedValue(result)

    await expect(controller.remove(1)).resolves.toEqual(result)
    expect(matieresPremieresServiceMock.remove).toHaveBeenCalledWith(1)
  })
})
