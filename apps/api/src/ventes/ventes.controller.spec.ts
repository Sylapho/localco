import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { CreateVenteDto } from './dto/create-vente.dto'
import { VentesController } from './ventes.controller'
import { VentesService } from './ventes.service'

describe('VentesController', () => {
  let controller: VentesController

  const ventesServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VentesController],
      providers: [
        {
          provide: VentesService,
          useValue: ventesServiceMock,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile()

    controller = module.get<VentesController>(VentesController)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('findAll should return ventes', async () => {
    const result = [{ id: 1, totalTTC: 12, lignes: [] }]
    ventesServiceMock.findAll.mockResolvedValue(result)

    await expect(controller.findAll()).resolves.toEqual(result)
    expect(ventesServiceMock.findAll).toHaveBeenCalled()
  })

  it('findOne should return one vente', async () => {
    const result = { id: 1, totalTTC: 12, lignes: [] }
    ventesServiceMock.findOne.mockResolvedValue(result)

    await expect(controller.findOne(1)).resolves.toEqual(result)
    expect(ventesServiceMock.findOne).toHaveBeenCalledWith(1)
  })

  it('create should return created vente', async () => {
    const body: CreateVenteDto = {
      mode: 'cb',
      remise: 0,
      lignes: [{ articleId: 1, quantite: 2 }],
    }
    const result = { id: 1, totalTTC: 4.2, lignes: [] }

    ventesServiceMock.create.mockResolvedValue(result)

    await expect(controller.create(body)).resolves.toEqual(result)
    expect(ventesServiceMock.create).toHaveBeenCalledWith(body)
  })
})
