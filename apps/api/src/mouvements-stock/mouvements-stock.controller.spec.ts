import { Test, TestingModule } from '@nestjs/testing'
import { BetterAuthGuard } from '../auth/better-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { MouvementsStockController } from './mouvements-stock.controller'
import { MouvementsStockService } from './mouvements-stock.service'

describe('MouvementsStockController', () => {
  let controller: MouvementsStockController

  const mouvementsStockServiceMock = {
    findAll: jest.fn(),
    findLots: jest.fn(),
    markLotAsLoss: jest.fn(),
    createAjustement: jest.fn(),
    createReceptionMatiere: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MouvementsStockController],
      providers: [
        {
          provide: MouvementsStockService,
          useValue: mouvementsStockServiceMock,
        },
      ],
    })
      .overrideGuard(BetterAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile()

    controller = module.get<MouvementsStockController>(
      MouvementsStockController,
    )
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  it('findAll should return movements', async () => {
    const result = [{ id: 1, type: 'reception' }]
    mouvementsStockServiceMock.findAll.mockResolvedValue(result)

    await expect(controller.findAll()).resolves.toEqual(result)
  })

  it('findLots should return stock lots', async () => {
    const result = [{ id: 1, remainingQuantity: 4 }]
    mouvementsStockServiceMock.findLots.mockResolvedValue(result)

    await expect(controller.findLots()).resolves.toEqual(result)
  })

  it('markLotAsLoss should pass lot id and user id to service', async () => {
    const result = { id: 1, type: 'perte' }
    mouvementsStockServiceMock.markLotAsLoss.mockResolvedValue(result)

    await expect(
      controller.markLotAsLoss(7, { userId: 'user_123' }),
    ).resolves.toEqual(result)
    expect(mouvementsStockServiceMock.markLotAsLoss).toHaveBeenCalledWith(
      7,
      'user_123',
    )
  })

  it('createAjustement should pass body and user id to service', async () => {
    const body = {
      cible: 'article' as const,
      cibleId: 1,
      quantite: 2,
      motif: 'Inventaire',
    }
    const result = { id: 1, ...body }
    mouvementsStockServiceMock.createAjustement.mockResolvedValue(result)

    await expect(
      controller.createAjustement(body, { userId: 'user_123' }),
    ).resolves.toEqual(result)
    expect(mouvementsStockServiceMock.createAjustement).toHaveBeenCalledWith(
      body,
      'user_123',
    )
  })

  it('createReceptionMatiere should pass params and user id to service', async () => {
    const body = {
      quantite: 5,
      motif: 'Livraison',
    }
    const result = { id: 1, type: 'reception' }
    mouvementsStockServiceMock.createReceptionMatiere.mockResolvedValue(result)

    await expect(
      controller.createReceptionMatiere(3, body, { userId: 'user_123' }),
    ).resolves.toEqual(result)
    expect(
      mouvementsStockServiceMock.createReceptionMatiere,
    ).toHaveBeenCalledWith(3, body, 'user_123')
  })
})
