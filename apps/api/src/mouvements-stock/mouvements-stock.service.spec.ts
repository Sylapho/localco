import { BadRequestException } from '@nestjs/common'
import { MouvementsStockService } from './mouvements-stock.service'

describe('MouvementsStockService', () => {
  const tx = {
    article: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    matierePremiere: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    mouvementStock: {
      create: jest.fn(),
    },
    stockLot: {
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  }

  const prismaMock = {
    mouvementStock: {
      findMany: jest.fn(),
    },
    stockLot: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  }

  let service: MouvementsStockService

  beforeEach(() => {
    jest.clearAllMocks()
    tx.stockLot.findMany.mockResolvedValue([])
    service = new MouvementsStockService(prismaMock as never)
  })

  it('findAll should return movements ordered by date desc', async () => {
    const result = [{ id: 1, createdAt: new Date() }]
    prismaMock.mouvementStock.findMany.mockResolvedValue(result)

    await expect(service.findAll()).resolves.toEqual(result)
    expect(prismaMock.mouvementStock.findMany).toHaveBeenCalledWith({
      include: {
        article: true,
        mp: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  })

  it('findLots should return remaining lots ordered by DLC', async () => {
    const result = [{ id: 1, remainingQuantity: 2 }]
    prismaMock.stockLot.findMany.mockResolvedValue(result)

    await expect(service.findLots()).resolves.toEqual(result)
    expect(prismaMock.stockLot.findMany).toHaveBeenCalledWith({
      where: {
        remainingQuantity: {
          gt: 0,
        },
      },
      include: {
        article: true,
        mp: true,
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
    })
  })

  it('createReceptionMatiere should increase raw material stock and create movement', async () => {
    const movement = { id: 1, type: 'reception' }
    tx.matierePremiere.findUniqueOrThrow.mockResolvedValue({
      id: 2,
      stock: 10,
    })
    tx.mouvementStock.create.mockResolvedValue(movement)

    await expect(
      service.createReceptionMatiere(
        2,
        {
          quantite: 4,
          motif: 'Livraison',
        },
        'user_123',
      ),
    ).resolves.toEqual(movement)

    expect(tx.matierePremiere.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: {
        stock: 14,
      },
    })
    expect(tx.mouvementStock.create).toHaveBeenCalledWith({
      data: {
        type: 'reception',
        cible: 'matiere_premiere',
        mpId: 2,
        quantite: 4,
        stockAvant: 10,
        stockApres: 14,
        motif: 'Livraison',
        reference: 'matiere-premiere:2',
        createdByUserId: 'user_123',
      },
      include: {
        article: true,
        mp: true,
      },
    })
  })

  it('createAjustement should adjust article stock and create movement', async () => {
    const movement = { id: 1, type: 'ajustement' }
    tx.article.findUniqueOrThrow.mockResolvedValue({
      id: 1,
      stock: 8,
    })
    tx.mouvementStock.create.mockResolvedValue(movement)

    await expect(
      service.createAjustement(
        {
          cible: 'article',
          cibleId: 1,
          quantite: -3,
          motif: 'Casse',
        },
        'user_123',
      ),
    ).resolves.toEqual(movement)

    expect(tx.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: 5,
      },
    })
    expect(tx.mouvementStock.create).toHaveBeenCalledWith({
      data: {
        type: 'ajustement',
        cible: 'article',
        articleId: 1,
        quantite: -3,
        stockAvant: 8,
        stockApres: 5,
        motif: 'Casse',
        reference: undefined,
        createdByUserId: 'user_123',
      },
      include: {
        article: true,
        mp: true,
      },
    })
  })

  it('createAjustement should reject zero quantity', async () => {
    await expect(
      service.createAjustement({
        cible: 'article',
        cibleId: 1,
        quantite: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('createAjustement should reject decimal article quantity', async () => {
    await expect(
      service.createAjustement({
        cible: 'article',
        cibleId: 1,
        quantite: 1.5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('createAjustement should reject negative resulting stock', async () => {
    tx.matierePremiere.findUniqueOrThrow.mockResolvedValue({
      id: 2,
      stock: 1,
    })

    await expect(
      service.createAjustement({
        cible: 'matiere_premiere',
        cibleId: 2,
        quantite: -2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
