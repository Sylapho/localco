import { Test, TestingModule } from '@nestjs/testing'
import { CaisseController } from './caisse.controller'
import { CaisseService } from './caisse.service'

describe('CaisseController', () => {
  let controller: CaisseController

  const caisseServiceMock = {
    getTodaySummary: jest.fn(),
    closeToday: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaisseController],
      providers: [
        {
          provide: CaisseService,
          useValue: caisseServiceMock,
        },
      ],
    }).compile()

    controller = module.get<CaisseController>(CaisseController)
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('getToday should return today summary', async () => {
    const result = {
      status: 'open',
      totals: {
        totalTTC: 0,
      },
    }

    caisseServiceMock.getTodaySummary.mockResolvedValue(result)

    await expect(controller.getToday()).resolves.toEqual(result)
    expect(caisseServiceMock.getTodaySummary).toHaveBeenCalled()
  })

  it('cloturer should close today cash register', async () => {
    const result = {
      id: 1,
      totalTTC: 42,
    }

    caisseServiceMock.closeToday.mockResolvedValue(result)

    await expect(controller.cloturer()).resolves.toEqual(result)
    expect(caisseServiceMock.closeToday).toHaveBeenCalled()
  })
})
