import { BadRequestException } from '@nestjs/common'
import { MouvementsStockService } from './mouvements-stock.service'

describe('MouvementsStockService', () => {
  const tx = {
    $queryRaw: jest.fn(),
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
      updateMany: jest.fn(),
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
    tx.$queryRaw.mockResolvedValue([])
    tx.stockLot.findMany.mockResolvedValue([])
    tx.stockLot.updateMany.mockResolvedValue({ count: 1 })
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
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
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

  it('markLotAsLoss should never increase a negative article stock', async () => {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() - 1)
    expiresAt.setHours(0, 0, 0, 0)

    const movement = {
      id: 42,
      type: 'perte',
      cible: 'article',
      articleId: 1,
      quantite: -2,
      stockAvant: -3,
      stockApres: -5,
    }

    tx.stockLot.findUniqueOrThrow
      .mockResolvedValueOnce({
        target: 'article',
        articleId: 1,
        mpId: null,
      })
      .mockResolvedValueOnce({
        id: 12,
        target: 'article',
        articleId: 1,
        mpId: null,
        remainingQuantity: 2,
        expiresAt,
      })

    tx.article.findUniqueOrThrow.mockResolvedValue({
      id: 1,
      stock: -3,
    })

    tx.article.update.mockResolvedValue({
      id: 1,
      stock: -5,
    })

    tx.stockLot.update.mockResolvedValue({
      id: 12,
      remainingQuantity: 0,
    })

    tx.mouvementStock.create.mockResolvedValue(movement)

    await expect(service.markLotAsLoss(12, 'user_123')).resolves.toEqual(
      movement,
    )

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2)

    expect(tx.article.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        stock: -5,
      },
    })

    expect(tx.stockLot.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: {
        remainingQuantity: 0,
      },
    })

    expect(tx.mouvementStock.create).toHaveBeenCalledWith({
      data: {
        type: 'perte',
        cible: 'article',
        articleId: 1,
        quantite: -2,
        stockAvant: -3,
        stockApres: -5,
        motif: 'Lot périmé #12',
        reference: 'stock-lot:12:perte',
        createdByUserId: 'user_123',
      },
      include: {
        article: true,
        mp: true,
      },
    })

    const createdMovement = tx.mouvementStock.create.mock.calls[0][0].data

    expect(createdMovement.quantite).toBeLessThan(0)
    expect(createdMovement.stockApres).toBeLessThan(createdMovement.stockAvant)
  })

  it('recordArticleMovement should reject a positive loss movement', async () => {
    await expect(
      service.recordArticleMovement(tx as never, {
        articleId: 1,
        quantite: 2,
        stockAvant: -3,
        stockApres: -1,
        type: 'perte',
        motif: 'Perte invalide',
      }),
    ).rejects.toThrow(
      'Un mouvement de perte doit avoir un delta négatif et ne peut pas augmenter le stock',
    )

    expect(tx.$queryRaw).not.toHaveBeenCalled()
    expect(tx.mouvementStock.create).not.toHaveBeenCalled()
  })

  it('recordArticleMovement should lock consumable lots and decrement them conditionally', async () => {
    const expiresAt = new Date('2026-06-20T00:00:00.000Z')
    const createdAt = new Date('2026-06-01T00:00:00.000Z')

    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 7,
        remainingQuantity: 3,
        expiresAt,
        createdAt,
      },
    ])

    tx.mouvementStock.create.mockResolvedValue({
      id: 1,
      type: 'ajustement',
    })

    await service.recordArticleMovement(tx as never, {
      articleId: 1,
      quantite: -2,
      stockAvant: 5,
      stockApres: 3,
      type: 'ajustement',
      motif: 'Sortie',
    })

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
    expect(tx.stockLot.updateMany).toHaveBeenCalledWith({
      where: {
        id: 7,
        remainingQuantity: {
          gte: 2,
        },
      },
      data: {
        remainingQuantity: {
          decrement: 2,
        },
      },
    })
  })

  it('recordArticleMovement should reject when a locked lot cannot be decremented', async () => {
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 7,
        remainingQuantity: 2,
        expiresAt: new Date('2026-06-20T00:00:00.000Z'),
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ])
    tx.stockLot.updateMany.mockResolvedValueOnce({ count: 0 })

    await expect(
      service.recordArticleMovement(tx as never, {
        articleId: 1,
        quantite: -2,
        stockAvant: 5,
        stockApres: 3,
        type: 'ajustement',
      }),
    ).rejects.toThrow('Le lot de stock a changé pendant la consommation')

    expect(tx.mouvementStock.create).not.toHaveBeenCalled()
  })
})
