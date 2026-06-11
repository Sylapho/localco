import request from 'supertest'
import { createArticle } from './fixtures/articles'
import { getNextDateForWeekday, validPickupPoint } from './fixtures/dates'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'
import { truncateBusinessTables } from './helpers/database'
import { createSignedStripeEvent } from './helpers/stripe-events'

describe('API E2E - Stripe checkout reconciliation', () => {
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
    await dropStripeIdFailureTrigger()
    await testApp.app.close()
  })

  it('expires a Stripe session created but not persisted and releases the reservation', async () => {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: 2,
    })
    await installStripeIdFailureTrigger()

    try {
      await request(testApp.app.getHttpServer())
        .post('/api/commandes/checkout')
        .send(checkoutPayload(article.id, 5))
        .expect(400)
    } finally {
      await dropStripeIdFailureTrigger()
    }

    const [commande, updatedArticle, releaseMovements, reconciliations] =
      await Promise.all([
        testApp.prisma.commande.findFirstOrThrow(),
        testApp.prisma.article.findUniqueOrThrow({
          where: { id: article.id },
        }),
        testApp.prisma.mouvementStock.findMany({
          where: {
            reference: {
              endsWith: ':reservation:release',
            },
          },
        }),
        testApp.prisma.stripeCheckoutReconciliation.findMany(),
      ])

    expect(testApp.stripe.expiredSessions).toEqual(['cs_test_e2e_success'])
    expect(commande).toMatchObject({
      statut: 'annulee',
      stripeId: null,
    })
    expect(updatedArticle.stock).toBe(2)
    expect(releaseMovements).toHaveLength(1)
    expect(reconciliations).toHaveLength(0)
  })

  it('records reconciliation when the unpersisted Stripe session cannot be expired', async () => {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: 2,
    })
    testApp.stripe.failNextExpiration(new Error('Stripe API timeout'))
    await installStripeIdFailureTrigger()

    try {
      await request(testApp.app.getHttpServer())
        .post('/api/commandes/checkout')
        .send(checkoutPayload(article.id, 5))
        .expect(400)
    } finally {
      await dropStripeIdFailureTrigger()
    }

    const commande = await testApp.prisma.commande.findFirstOrThrow()
    const reconciliation =
      await testApp.prisma.stripeCheckoutReconciliation.findFirstOrThrow()
    const updatedArticle = await testApp.prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    })

    expect(testApp.stripe.expiredSessions).toEqual(['cs_test_e2e_success'])
    expect(commande.statut).toBe('annulee')
    expect(updatedArticle.stock).toBe(2)
    expect(reconciliation).toMatchObject({
      commandeId: commande.id,
      stripeSessionId: 'cs_test_e2e_success',
      operation: 'expire_checkout_session',
      status: 'pending',
      attempts: 1,
      lastError: 'Stripe API timeout',
    })
    expect(reconciliation.lastAttemptedAt).toBeInstanceOf(Date)
  })

  it('does not confirm a cancelled order found through Stripe metadata after stripeId persistence failed', async () => {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: 2,
    })
    await installStripeIdFailureTrigger()

    try {
      await request(testApp.app.getHttpServer())
        .post('/api/commandes/checkout')
        .send(checkoutPayload(article.id, 5))
        .expect(400)
    } finally {
      await dropStripeIdFailureTrigger()
    }

    const commande = await testApp.prisma.commande.findFirstOrThrow()
    const event = createSignedStripeEvent({
      id: 'evt_e2e_paid_cancelled_without_stripe_id',
      type: 'checkout.session.completed',
      sessionId: 'cs_test_e2e_success',
      commandeId: commande.id,
      amountTotal: 1250,
    })

    await request(testApp.app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', event.signature)
      .set('Content-Type', 'application/json')
      .send(event.payload)
      .expect(201, { received: true })

    const [afterWebhook, reconciliations, releaseMovements] = await Promise.all(
      [
        testApp.prisma.commande.findUniqueOrThrow({
          where: { id: commande.id },
        }),
        testApp.prisma.stripeCheckoutReconciliation.findMany({
          orderBy: { id: 'asc' },
        }),
        testApp.prisma.mouvementStock.findMany({
          where: {
            reference: `commande:${commande.id}:reservation:release`,
          },
        }),
      ],
    )

    expect(afterWebhook.statut).toBe('annulee')
    expect(afterWebhook.stripeId).toBeNull()
    expect(testApp.emails.sentOrderConfirmations).toHaveLength(0)
    expect(releaseMovements).toHaveLength(1)
    expect(reconciliations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandeId: commande.id,
          stripeSessionId: 'cs_test_e2e_success',
          operation: 'review_paid_cancelled_checkout',
          status: 'pending',
        }),
      ]),
    )
  })

  async function installStripeIdFailureTrigger() {
    await dropStripeIdFailureTrigger()

    await testApp.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION e2e_fail_stripe_id_persistence()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."stripeId" IS NOT NULL AND OLD."stripeId" IS NULL THEN
          RAISE EXCEPTION 'e2e stripe id persistence failure';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    await testApp.prisma.$executeRawUnsafe(`
      CREATE TRIGGER e2e_fail_stripe_id_persistence
      BEFORE UPDATE OF "stripeId" ON "Commande"
      FOR EACH ROW
      EXECUTE FUNCTION e2e_fail_stripe_id_persistence();
    `)
  }

  async function dropStripeIdFailureTrigger() {
    await testApp.prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS e2e_fail_stripe_id_persistence ON "Commande";
    `)
    await testApp.prisma.$executeRawUnsafe(`
      DROP FUNCTION IF EXISTS e2e_fail_stripe_id_persistence();
    `)
  }
})

function checkoutPayload(articleId: number, quantity: number) {
  return {
    nom: 'Client E2E',
    email: 'client.e2e@example.com',
    tel: '0600000000',
    lieu: validPickupPoint,
    dateRetrait: getNextDateForWeekday(2),
    lignes: [{ articleId, quantite: quantity }],
  }
}
