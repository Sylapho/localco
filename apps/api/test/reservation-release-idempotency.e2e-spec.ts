import request from 'supertest'
import { ROLES } from '../src/auth/roles'
import { createArticle } from './fixtures/articles'
import { getNextDateForWeekday, validPickupPoint } from './fixtures/dates'
import { authAs } from './helpers/auth'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'
import { truncateBusinessTables } from './helpers/database'
import { createSignedStripeEvent } from './helpers/stripe-events'

describe('API E2E - order reservation release idempotency', () => {
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

  it('releases stock once when two manual cancellations run concurrently', async () => {
    const { articleId, commandeId } = await createReservedCheckout(2, 5)

    const [first, second] = await Promise.all([
      cancelManually(commandeId),
      cancelManually(commandeId),
    ])

    expect([first.status, second.status]).toEqual([200, 200])

    await expectSingleReleaseApplied({
      articleId,
      commandeId,
      finalStock: 2,
      releasedQuantity: 5,
    })
  })

  it('cancels a nouvelle order concurrently through the shared idempotent primitive', async () => {
    const { articleId, commandeId } = await createDirectOrderWithLot(10, 4)

    const results = await Promise.allSettled([
      cancelManually(commandeId),
      cancelManually(commandeId),
    ])

    expect(results).toHaveLength(2)
    for (const result of results) {
      expect(result.status).toBe('fulfilled')
      if (result.status === 'fulfilled') {
        expect(result.value.status).toBe(200)
      }
    }

    await expectSingleReleaseApplied({
      articleId,
      commandeId,
      finalStock: 10,
      releasedQuantity: 4,
      expectedRemainingLotQuantity: 10,
    })
  })

  it('cancels a preparee order idempotently through the shared primitive', async () => {
    const { articleId, commandeId } = await createDirectOrderWithLot(8, 3)

    await request(testApp.app.getHttpServer())
      .patch(`/api/commandes/${commandeId}/statut`)
      .set(authAs(ROLES.GERANT))
      .send({ statut: 'preparee' })
      .expect(200)

    await cancelManually(commandeId).expect(200)
    await cancelManually(commandeId).expect(200)

    await expectSingleReleaseApplied({
      articleId,
      commandeId,
      finalStock: 8,
      releasedQuantity: 3,
      expectedRemainingLotQuantity: 8,
    })
  })

  it('releases stock once when manual cancellation and Stripe expired webhook run concurrently', async () => {
    const { articleId, commandeId } = await createReservedCheckout(2, 5)
    const event = createSignedStripeEvent({
      id: 'evt_e2e_concurrent_expired_release',
      type: 'checkout.session.expired',
      sessionId: 'cs_test_e2e_success',
    })

    const [manualResponse, webhookResponse] = await Promise.all([
      cancelManually(commandeId),
      postSignedWebhook(event),
    ])

    expect(manualResponse.status).toBe(200)
    expect(webhookResponse.status).toBe(201)
    expect(webhookResponse.body).toEqual({ received: true })

    await expectSingleReleaseApplied({
      articleId,
      commandeId,
      finalStock: 2,
      releasedQuantity: 5,
    })
  })

  it('treats repeated sequential cancellation calls as idempotent', async () => {
    const { articleId, commandeId } = await createReservedCheckout(2, 5)

    await cancelManually(commandeId).expect(200)
    await cancelManually(commandeId).expect(200)
    await cancelManually(commandeId).expect(200)

    await expectSingleReleaseApplied({
      articleId,
      commandeId,
      finalStock: 2,
      releasedQuantity: 5,
    })
  })

  it('rolls back release operation, stock and status when restitution fails', async () => {
    const { articleId, commandeId } = await createReservedCheckout(2, 5)

    await installFailingArticleReleaseTrigger()

    try {
      await cancelManually(commandeId).expect(500)
    } finally {
      await dropFailingArticleReleaseTrigger()
    }

    const [commande, article, releaseOperations, releaseMovements] =
      await Promise.all([
        testApp.prisma.commande.findUniqueOrThrow({
          where: { id: commandeId },
        }),
        testApp.prisma.article.findUniqueOrThrow({
          where: { id: articleId },
        }),
        testApp.prisma.commandeReservationRelease.count({
          where: { commandeId },
        }),
        testApp.prisma.mouvementStock.count({
          where: { reference: `commande:${commandeId}:reservation:release` },
        }),
      ])

    expect(commande.statut).toBe('paiement_en_attente')
    expect(article.stock).toBe(-3)
    expect(releaseOperations).toBe(0)
    expect(releaseMovements).toBe(0)
  })

  async function createReservedCheckout(
    initialStock: number,
    quantity: number,
  ) {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: initialStock,
    })

    await request(testApp.app.getHttpServer())
      .post('/api/commandes/checkout')
      .send({
        nom: 'Client E2E',
        email: 'client.e2e@example.com',
        tel: '0600000000',
        lieu: validPickupPoint,
        dateRetrait: getNextDateForWeekday(2),
        lignes: [{ articleId: article.id, quantite: quantity }],
      })
      .expect(201)

    const commande = await testApp.prisma.commande.findFirstOrThrow()

    return {
      articleId: article.id,
      commandeId: commande.id,
    }
  }

  async function createDirectOrderWithLot(
    initialStock: number,
    quantity: number,
  ) {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: initialStock,
    })

    await testApp.prisma.stockLot.create({
      data: {
        target: 'article',
        articleId: article.id,
        initialQuantity: initialStock,
        remainingQuantity: initialStock,
        expiresAt: futureDate(10),
        reference: `article:${article.id}:initial`,
      },
    })

    const response = await request(testApp.app.getHttpServer())
      .post('/api/commandes')
      .set(authAs(ROLES.GERANT))
      .send({
        nom: 'Client E2E',
        email: 'client.e2e@example.com',
        tel: '0600000000',
        lieu: validPickupPoint,
        dateRetrait: getNextDateForWeekday(2),
        lignes: [{ articleId: article.id, quantite: quantity }],
      })
      .expect(201)

    return {
      articleId: article.id,
      commandeId: response.body.id as number,
    }
  }

  function cancelManually(commandeId: number) {
    return request(testApp.app.getHttpServer())
      .patch(`/api/commandes/${commandeId}/statut`)
      .set(authAs(ROLES.GERANT))
      .send({ statut: 'annulee' })
  }

  function postSignedWebhook(event: { payload: string; signature: string }) {
    return request(testApp.app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', event.signature)
      .set('Content-Type', 'application/json')
      .send(event.payload)
  }

  async function expectSingleReleaseApplied(data: {
    articleId: number
    commandeId: number
    finalStock: number
    releasedQuantity: number
    expectedRemainingLotQuantity?: number
  }) {
    const [commande, article, releaseOperations, releaseMovements, lots] =
      await Promise.all([
        testApp.prisma.commande.findUniqueOrThrow({
          where: { id: data.commandeId },
        }),
        testApp.prisma.article.findUniqueOrThrow({
          where: { id: data.articleId },
        }),
        testApp.prisma.commandeReservationRelease.count({
          where: { commandeId: data.commandeId },
        }),
        testApp.prisma.mouvementStock.findMany({
          where: {
            reference: `commande:${data.commandeId}:reservation:release`,
          },
        }),
        testApp.prisma.stockLot.findMany({
          where: {
            target: 'article',
            articleId: data.articleId,
            remainingQuantity: {
              gt: 0,
            },
          },
        }),
      ])

    expect(commande.statut).toBe('annulee')
    expect(article.stock).toBe(data.finalStock)
    expect(releaseOperations).toBe(1)
    expect(releaseMovements).toHaveLength(1)
    expect(releaseMovements[0]).toMatchObject({
      articleId: data.articleId,
      quantite: data.releasedQuantity,
      stockApres: data.finalStock,
    })

    if (data.expectedRemainingLotQuantity !== undefined) {
      expect(
        lots.reduce((total, lot) => total + lot.remainingQuantity, 0),
      ).toBe(data.expectedRemainingLotQuantity)
    }
  }

  async function installFailingArticleReleaseTrigger() {
    await testApp.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION e2e_fail_article_release()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."stock" > OLD."stock" THEN
          RAISE EXCEPTION 'e2e reservation release failure';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    await testApp.prisma.$executeRawUnsafe(`
      CREATE TRIGGER e2e_fail_article_release
      BEFORE UPDATE ON "Article"
      FOR EACH ROW
      EXECUTE FUNCTION e2e_fail_article_release();
    `)
  }

  async function dropFailingArticleReleaseTrigger() {
    await testApp.prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS e2e_fail_article_release ON "Article";
    `)
    await testApp.prisma.$executeRawUnsafe(`
      DROP FUNCTION IF EXISTS e2e_fail_article_release();
    `)
  }
})

function futureDate(days: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date
}
