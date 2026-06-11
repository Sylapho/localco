import request from 'supertest'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'
import { truncateBusinessTables } from './helpers/database'
import { createSignedStripeEvent } from './helpers/stripe-events'
import { createArticle } from './fixtures/articles'
import { getNextDateForWeekday, validPickupPoint } from './fixtures/dates'

describe('API E2E - checkout and Stripe webhooks', () => {
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

  it('POST /api/commandes/checkout creates a pending preorder and reserves stock', async () => {
    const article = await createArticle(testApp.prisma, {
      nom: 'Preorder article',
      prixCents: 250,
      stock: 2,
    })

    const response = await request(testApp.app.getHttpServer())
      .post('/api/commandes/checkout')
      .send(checkoutPayload(article.id, 5))
      .expect(201)

    expect(response.body).toEqual({
      url: 'https://checkout.stripe.test/e2e',
    })

    const commande = await testApp.prisma.commande.findFirstOrThrow({
      include: { lignes: true, historique: true },
    })
    const updatedArticle = await testApp.prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    })
    const mouvements = await testApp.prisma.mouvementStock.findMany()

    expect(commande).toMatchObject({
      statut: 'paiement_en_attente',
      stripeId: 'cs_test_e2e_success',
      totalTtcCents: 1250,
    })
    expect(commande.lignes).toEqual([
      expect.objectContaining({
        articleId: article.id,
        quantite: 5,
        prixUnitCents: 250,
      }),
    ])
    expect(updatedArticle.stock).toBe(-3)
    expect(mouvements).toEqual([
      expect.objectContaining({
        articleId: article.id,
        quantite: -5,
        stockAvant: 2,
        stockApres: -3,
        reference: `commande:${commande.id}:reservation`,
      }),
    ])
    expect(commande.historique).toEqual([
      expect.objectContaining({
        ancienStatut: null,
        nouveauStatut: 'paiement_en_attente',
        motif: 'checkout_cree',
      }),
    ])
  })

  it('POST /api/commandes/checkout rolls back reservation when Stripe fails', async () => {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: 2,
    })
    testApp.stripe.failNextSession()

    await request(testApp.app.getHttpServer())
      .post('/api/commandes/checkout')
      .send(checkoutPayload(article.id, 5))
      .expect(400)

    const commande = await testApp.prisma.commande.findFirstOrThrow({
      include: { historique: true },
    })
    const updatedArticle = await testApp.prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    })
    const mouvements = await testApp.prisma.mouvementStock.findMany({
      orderBy: { id: 'asc' },
    })

    expect(commande.statut).toBe('annulee')
    expect(updatedArticle.stock).toBe(2)
    expect(mouvements.map((movement) => movement.reference)).toEqual([
      `commande:${commande.id}:reservation`,
      `commande:${commande.id}:reservation:release`,
    ])
    expect(commande.historique).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nouveauStatut: 'annulee',
          motif: 'checkout_stripe_creation_echec',
        }),
      ]),
    )
    expect(testApp.emails.sentOrderConfirmations).toHaveLength(0)
  })

  it('signed checkout.session.completed confirms once and ignores duplicate event', async () => {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: 2,
    })

    await request(testApp.app.getHttpServer())
      .post('/api/commandes/checkout')
      .send(checkoutPayload(article.id, 5))
      .expect(201)

    const commande = await testApp.prisma.commande.findFirstOrThrow()
    const event = createSignedStripeEvent({
      id: 'evt_e2e_completed_once',
      type: 'checkout.session.completed',
      sessionId: 'cs_test_e2e_success',
    })

    await postSignedWebhook(testApp, event).expect(201, { received: true })
    await postSignedWebhook(testApp, event).expect(201, {
      received: true,
      duplicate: true,
    })

    const confirmed = await testApp.prisma.commande.findUniqueOrThrow({
      where: { id: commande.id },
      include: { historique: true },
    })
    const movements = await testApp.prisma.mouvementStock.findMany()
    const webhookEvent =
      await testApp.prisma.stripeWebhookEvent.findUniqueOrThrow({
        where: { eventId: 'evt_e2e_completed_once' },
      })

    expect(confirmed.statut).toBe('nouvelle')
    expect(
      confirmed.historique.filter(
        (entry) => entry.motif === 'paiement_confirme',
      ),
    ).toHaveLength(1)
    expect(movements).toHaveLength(1)
    expect(testApp.emails.sentOrderConfirmations).toEqual([
      { id: commande.id, email: 'client.e2e@example.com' },
    ])
    expect(webhookEvent).toMatchObject({
      type: 'checkout.session.completed',
      status: 'processed',
      attempts: 1,
      lastError: null,
    })
    expect(webhookEvent.processedAt).toBeInstanceOf(Date)
  })

  it('signed checkout.session.expired cancels pending order and releases stock once', async () => {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: 2,
    })

    await request(testApp.app.getHttpServer())
      .post('/api/commandes/checkout')
      .send(checkoutPayload(article.id, 5))
      .expect(201)

    const commande = await testApp.prisma.commande.findFirstOrThrow()
    const event = createSignedStripeEvent({
      id: 'evt_e2e_expired_once',
      type: 'checkout.session.expired',
      sessionId: 'cs_test_e2e_success',
    })

    await postSignedWebhook(testApp, event).expect(201, { received: true })
    await postSignedWebhook(testApp, event).expect(201, {
      received: true,
      duplicate: true,
    })

    const cancelled = await testApp.prisma.commande.findUniqueOrThrow({
      where: { id: commande.id },
      include: { historique: true },
    })
    const updatedArticle = await testApp.prisma.article.findUniqueOrThrow({
      where: { id: article.id },
    })
    const releaseMovements = await testApp.prisma.mouvementStock.findMany({
      where: { reference: `commande:${commande.id}:reservation:release` },
    })

    expect(cancelled.statut).toBe('annulee')
    expect(updatedArticle.stock).toBe(2)
    expect(releaseMovements).toHaveLength(1)
    expect(
      cancelled.historique.filter((entry) => entry.motif === 'checkout_expire'),
    ).toHaveLength(1)
    expect(testApp.emails.sentOrderConfirmations).toHaveLength(0)
  })

  it('retries a failed completed webhook and processes it successfully later', async () => {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: 2,
    })

    await request(testApp.app.getHttpServer())
      .post('/api/commandes/checkout')
      .send(checkoutPayload(article.id, 5))
      .expect(201)

    const commande = await testApp.prisma.commande.findFirstOrThrow()
    const event = createSignedStripeEvent({
      id: 'evt_e2e_retry_after_failure',
      type: 'checkout.session.completed',
      sessionId: 'cs_test_e2e_success',
    })

    await installFailingPaidConfirmationTrigger(testApp)

    try {
      await postSignedWebhook(testApp, event).expect(500)
    } finally {
      await dropFailingPaidConfirmationTrigger(testApp)
    }

    const failedEvent =
      await testApp.prisma.stripeWebhookEvent.findUniqueOrThrow({
        where: { eventId: 'evt_e2e_retry_after_failure' },
      })
    const stillPending = await testApp.prisma.commande.findUniqueOrThrow({
      where: { id: commande.id },
    })

    expect(failedEvent).toMatchObject({
      status: 'failed',
      attempts: 1,
    })
    expect(failedEvent.lastError).toContain('e2e paid confirmation failure')
    expect(failedEvent.processedAt).toBeNull()
    expect(stillPending.statut).toBe('paiement_en_attente')

    await postSignedWebhook(testApp, event).expect(201, { received: true })

    const processedEvent =
      await testApp.prisma.stripeWebhookEvent.findUniqueOrThrow({
        where: { eventId: 'evt_e2e_retry_after_failure' },
      })
    const confirmed = await testApp.prisma.commande.findUniqueOrThrow({
      where: { id: commande.id },
      include: { historique: true },
    })

    expect(processedEvent).toMatchObject({
      status: 'processed',
      attempts: 2,
      lastError: null,
    })
    expect(processedEvent.processedAt).toBeInstanceOf(Date)
    expect(confirmed.statut).toBe('nouvelle')
    expect(
      confirmed.historique.filter(
        (entry) => entry.motif === 'paiement_confirme',
      ),
    ).toHaveLength(1)
    expect(testApp.emails.sentOrderConfirmations).toEqual([
      { id: commande.id, email: 'client.e2e@example.com' },
    ])
  })

  it('GET /api/commandes/checkout-session/:sessionId returns a limited public summary', async () => {
    const article = await createArticle(testApp.prisma, {
      nom: 'Summary article',
      prixCents: 300,
      stock: 10,
    })
    await request(testApp.app.getHttpServer())
      .post('/api/commandes/checkout')
      .send(checkoutPayload(article.id, 2))
      .expect(201)

    const response = await request(testApp.app.getHttpServer())
      .get('/api/commandes/checkout-session/cs_test_e2e_success')
      .expect(200)

    expect(response.body).toMatchObject({
      totalTtcCents: 600,
      paiementStatut: 'en_attente',
      lignes: [
        {
          nom: 'Summary article',
          quantite: 2,
          prixUnitCents: 300,
          totalCents: 600,
        },
      ],
    })
    expect(response.body).not.toHaveProperty('email')
    expect(response.body).not.toHaveProperty('tel')
    expect(response.body).not.toHaveProperty('historique')

    await request(testApp.app.getHttpServer())
      .get('/api/commandes/checkout-session/cs_unknown')
      .expect(404)
  })
})

function checkoutPayload(articleId: number, quantite: number) {
  return {
    nom: 'Client E2E',
    email: 'client.e2e@example.com',
    tel: '0600000000',
    lieu: validPickupPoint,
    dateRetrait: getNextDateForWeekday(2),
    lignes: [{ articleId, quantite }],
  }
}

function postSignedWebhook(
  testApp: E2eTestApp,
  event: { payload: string; signature: string },
) {
  return request(testApp.app.getHttpServer())
    .post('/api/commandes/stripe/webhook')
    .set('stripe-signature', event.signature)
    .set('Content-Type', 'application/json')
    .send(event.payload)
}

async function installFailingPaidConfirmationTrigger(testApp: E2eTestApp) {
  await testApp.prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION e2e_fail_paid_confirmation()
    RETURNS trigger AS $$
    BEGIN
      IF OLD."statut" = 'paiement_en_attente' AND NEW."statut" = 'nouvelle' THEN
        RAISE EXCEPTION 'e2e paid confirmation failure';
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `)

  await testApp.prisma.$executeRawUnsafe(`
    CREATE TRIGGER e2e_fail_paid_confirmation
    BEFORE UPDATE ON "Commande"
    FOR EACH ROW
    EXECUTE FUNCTION e2e_fail_paid_confirmation();
  `)
}

async function dropFailingPaidConfirmationTrigger(testApp: E2eTestApp) {
  await testApp.prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS e2e_fail_paid_confirmation ON "Commande";
  `)
  await testApp.prisma.$executeRawUnsafe(`
    DROP FUNCTION IF EXISTS e2e_fail_paid_confirmation();
  `)
}
