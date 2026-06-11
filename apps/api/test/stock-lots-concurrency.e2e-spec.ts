import request from 'supertest'
import { ROLES } from '../src/auth/roles'
import { createArticle } from './fixtures/articles'
import { authAs } from './helpers/auth'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'
import { truncateBusinessTables } from './helpers/database'

describe('API E2E - stock lot concurrency', () => {
  let testApp: E2eTestApp

  beforeAll(async () => {
    testApp = await createTestApp()
  })

  beforeEach(async () => {
    await truncateBusinessTables(testApp.prisma)
    testApp.emails.reset()
    testApp.stripe.reset()
  })

  afterAll(async () => {
    await testApp.app.close()
  })

  it('does not consume the same lot quantity twice with concurrent adjustments', async () => {
    const article = await createArticle(testApp.prisma, {
      stock: 5,
      prixCents: 250,
    })
    const lot = await createArticleLot(article.id, {
      initialQuantity: 5,
      remainingQuantity: 5,
      expiresAt: futureDate(10),
    })

    const responses = await Promise.all([
      consumeArticle(article.id, 4, 'concurrent-consume-a'),
      consumeArticle(article.id, 4, 'concurrent-consume-b'),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 400,
    ])

    const [updatedLot, articleAfter, movements] = await Promise.all([
      testApp.prisma.stockLot.findUniqueOrThrow({ where: { id: lot.id } }),
      testApp.prisma.article.findUniqueOrThrow({ where: { id: article.id } }),
      testApp.prisma.mouvementStock.findMany({
        where: {
          articleId: article.id,
          quantite: {
            lt: 0,
          },
        },
      }),
    ])

    expect(updatedLot.remainingQuantity).toBe(1)
    expect(updatedLot.remainingQuantity).toBeGreaterThanOrEqual(0)
    expect(articleAfter.stock).toBe(1)
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({
      articleId: article.id,
      quantite: -4,
      stockAvant: 5,
      stockApres: 1,
    })
    expectLotInvariant({
      initialQuantity: lot.initialQuantity,
      remainingQuantity: updatedLot.remainingQuantity,
      consumedQuantity: 4,
      lostQuantity: 0,
    })
  })

  it('consumes concurrent adjustments across several lots in deterministic FEFO order', async () => {
    const article = await createArticle(testApp.prisma, {
      stock: 8,
      prixCents: 250,
    })
    const earliest = await createArticleLot(article.id, {
      initialQuantity: 2,
      remainingQuantity: 2,
      expiresAt: futureDate(5),
      createdAt: date('2026-06-01T08:00:00.000Z'),
      reference: 'earliest',
    })
    const sameExpiryOlder = await createArticleLot(article.id, {
      initialQuantity: 3,
      remainingQuantity: 3,
      expiresAt: futureDate(7),
      createdAt: date('2026-06-01T09:00:00.000Z'),
      reference: 'same-expiry-older',
    })
    const sameExpiryNewer = await createArticleLot(article.id, {
      initialQuantity: 5,
      remainingQuantity: 5,
      expiresAt: futureDate(7),
      createdAt: date('2026-06-01T10:00:00.000Z'),
      reference: 'same-expiry-newer',
    })

    const responses = await Promise.all([
      consumeArticle(article.id, 4, 'fefo-concurrent-a'),
      consumeArticle(article.id, 4, 'fefo-concurrent-b'),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 201,
    ])

    const lots = await testApp.prisma.stockLot.findMany({
      where: { articleId: article.id },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    })
    const movements = await testApp.prisma.mouvementStock.findMany({
      where: { articleId: article.id, quantite: { lt: 0 } },
      orderBy: { id: 'asc' },
    })

    expect(lots.map((lot) => [lot.id, lot.remainingQuantity])).toEqual([
      [earliest.id, 0],
      [sameExpiryOlder.id, 0],
      [sameExpiryNewer.id, 2],
    ])
    expect(movements).toHaveLength(2)
    expect(movements.map((movement) => movement.quantite)).toEqual([-4, -4])
    expectLotInvariant({
      initialQuantity:
        earliest.initialQuantity +
        sameExpiryOlder.initialQuantity +
        sameExpiryNewer.initialQuantity,
      remainingQuantity: lots.reduce(
        (total, lot) => total + lot.remainingQuantity,
        0,
      ),
      consumedQuantity: 8,
      lostQuantity: 0,
    })
  })

  it('keeps an expired lot quantity from being both consumed and marked as loss', async () => {
    const article = await createArticle(testApp.prisma, {
      stock: 10,
      prixCents: 250,
    })
    const expiredLot = await createArticleLot(article.id, {
      initialQuantity: 5,
      remainingQuantity: 5,
      expiresAt: pastDate(2),
    })

    const [consumeResponse, lossResponse] = await Promise.all([
      consumeArticle(article.id, 5, 'consume-while-loss'),
      request(testApp.app.getHttpServer())
        .post(`/api/mouvements-stock/lots/${expiredLot.id}/perte`)
        .set(authAs(ROLES.STOCK)),
    ])

    expect(consumeResponse.status).toBe(201)
    expect(lossResponse.status).toBe(201)

    const [updatedLot, lossMovements, consumeMovements] = await Promise.all([
      testApp.prisma.stockLot.findUniqueOrThrow({
        where: { id: expiredLot.id },
      }),
      testApp.prisma.mouvementStock.findMany({
        where: { reference: `stock-lot:${expiredLot.id}:perte` },
      }),
      testApp.prisma.mouvementStock.findMany({
        where: {
          motif: 'consume-while-loss',
        },
      }),
    ])

    expect(updatedLot.remainingQuantity).toBe(0)
    expect(lossMovements).toHaveLength(1)
    expect(lossMovements[0]).toMatchObject({
      type: 'perte',
      quantite: -5,
    })
    expect(consumeMovements).toHaveLength(1)
    expectLotInvariant({
      initialQuantity: expiredLot.initialQuantity,
      remainingQuantity: updatedLot.remainingQuantity,
      consumedQuantity: 0,
      lostQuantity: Math.abs(lossMovements[0].quantite),
    })
  })

  it('rejects a direct PostgreSQL write that would make a lot quantity negative', async () => {
    const article = await createArticle(testApp.prisma, {
      stock: 1,
      prixCents: 250,
    })
    const lot = await createArticleLot(article.id, {
      initialQuantity: 1,
      remainingQuantity: 1,
      expiresAt: futureDate(1),
    })

    await expect(
      testApp.prisma.$executeRaw`
        UPDATE "StockLot"
        SET "remainingQuantity" = -1
        WHERE "id" = ${lot.id}
      `,
    ).rejects.toThrow()

    const updatedLot = await testApp.prisma.stockLot.findUniqueOrThrow({
      where: { id: lot.id },
    })

    expect(updatedLot.remainingQuantity).toBe(1)
  })

  function consumeArticle(
    articleId: number,
    quantity: number,
    reference: string,
  ) {
    return request(testApp.app.getHttpServer())
      .post('/api/mouvements-stock/ajustement')
      .set(authAs(ROLES.STOCK))
      .send({
        cible: 'article',
        cibleId: articleId,
        quantite: -quantity,
        motif: reference,
      })
  }

  function createArticleLot(
    articleId: number,
    data: {
      initialQuantity: number
      remainingQuantity: number
      expiresAt: Date
      createdAt?: Date
      reference?: string
    },
  ) {
    return testApp.prisma.stockLot.create({
      data: {
        target: 'article',
        articleId,
        initialQuantity: data.initialQuantity,
        remainingQuantity: data.remainingQuantity,
        expiresAt: data.expiresAt,
        createdAt: data.createdAt,
        reference: data.reference,
      },
    })
  }
})

function expectLotInvariant(data: {
  initialQuantity: number
  remainingQuantity: number
  consumedQuantity: number
  lostQuantity: number
}) {
  expect(data.initialQuantity).toBe(
    data.remainingQuantity + data.consumedQuantity + data.lostQuantity,
  )
}

function futureDate(days: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date
}

function pastDate(days: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

function date(value: string) {
  return new Date(value)
}
