import request from 'supertest'
import { ROLES } from '../src/auth/roles'
import { createArticle } from './fixtures/articles'
import { createPendingCommande } from './fixtures/commandes'
import {
  daysAgo,
  getNextDateForWeekday,
  validPickupPoint,
} from './fixtures/dates'
import { authAs } from './helpers/auth'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'
import { truncateBusinessTables } from './helpers/database'
import { createSignedStripeEvent } from './helpers/stripe-events'

describe('API E2E - abandoned cleanup Stripe safety', () => {
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
    await dropFailingArticleReleaseTrigger()
    await testApp.app.close()
  })

  it('does not release stock when a paid webhook wins while cleanup is expiring Stripe', async () => {
    const { articleId, commandeId, stripeId } = await createOldReservedCheckout(
      'cs_cleanup_race_paid',
    )
    const expiration = testApp.stripe.pauseNextExpiration()

    const cleanupPromise = startCleanupAbandoned()
    await expiration.started

    const paidEvent = createSignedStripeEvent({
      id: 'evt_cleanup_race_paid',
      type: 'checkout.session.completed',
      sessionId: stripeId,
      commandeId,
      amountTotal: 1250,
    })

    await postSignedWebhook(paidEvent).expect(201, { received: true })
    expiration.release({ status: 'already_paid' })

    const cleanupResponse = await cleanupPromise

    expect(cleanupResponse.body).toEqual({
      scanned: 1,
      cancelled: 0,
      skipped: 1,
      failed: 0,
    })

    const [commande, article, releaseMovements, reconciliations] =
      await Promise.all([
        testApp.prisma.commande.findUniqueOrThrow({
          where: { id: commandeId },
          include: { historique: true },
        }),
        testApp.prisma.article.findUniqueOrThrow({
          where: { id: articleId },
        }),
        testApp.prisma.mouvementStock.findMany({
          where: { reference: `commande:${commandeId}:reservation:release` },
        }),
        testApp.prisma.stripeCheckoutReconciliation.findMany(),
      ])

    expect(commande.statut).toBe('nouvelle')
    expect(article.stock).toBe(-3)
    expect(releaseMovements).toHaveLength(0)
    expect(reconciliations).toHaveLength(0)
    expect(
      commande.historique.filter(
        (entry) => entry.motif === 'paiement_confirme',
      ),
    ).toHaveLength(1)
    expect(
      commande.historique.filter(
        (entry) => entry.motif === 'commande_abandonnee',
      ),
    ).toHaveLength(0)
  })

  it('records one reconciliation and keeps stock reserved when Stripe expiration fails', async () => {
    const { articleId, commandeId, stripeId } = await createOldReservedCheckout(
      'cs_cleanup_expire_failed',
    )

    testApp.stripe.setNextExpirationResult({
      status: 'failed',
      retryable: true,
      reason: 'Stripe API timeout',
    })

    await cleanupAbandoned().expect(201, {
      scanned: 1,
      cancelled: 0,
      skipped: 1,
      failed: 0,
    })

    testApp.stripe.setNextExpirationResult({
      status: 'failed',
      retryable: true,
      reason: 'Stripe API timeout',
    })

    await cleanupAbandoned().expect(201, {
      scanned: 1,
      cancelled: 0,
      skipped: 1,
      failed: 0,
    })

    const [commande, article, releaseMovements, reconciliations] =
      await Promise.all([
        testApp.prisma.commande.findUniqueOrThrow({
          where: { id: commandeId },
        }),
        testApp.prisma.article.findUniqueOrThrow({
          where: { id: articleId },
        }),
        testApp.prisma.mouvementStock.findMany({
          where: { reference: `commande:${commandeId}:reservation:release` },
        }),
        testApp.prisma.stripeCheckoutReconciliation.findMany(),
      ])

    expect(commande.statut).toBe('paiement_en_attente')
    expect(article.stock).toBe(-3)
    expect(releaseMovements).toHaveLength(0)
    expect(reconciliations).toEqual([
      expect.objectContaining({
        commandeId,
        stripeSessionId: stripeId,
        operation: 'expire_checkout_session',
        status: 'pending',
        attempts: 2,
        lastError: 'Stripe API timeout',
      }),
    ])
  })

  it('treats an already expired Stripe session as idempotent before releasing once', async () => {
    const { articleId, commandeId } = await createOldReservedCheckout(
      'cs_cleanup_already_expired',
    )

    testApp.stripe.setNextExpirationResult({ status: 'already_expired' })

    await cleanupAbandoned().expect(201, {
      scanned: 1,
      cancelled: 1,
      skipped: 0,
      failed: 0,
    })
    await cleanupAbandoned().expect(201, {
      scanned: 0,
      cancelled: 0,
      skipped: 0,
      failed: 0,
    })

    await expectSingleRelease({
      articleId,
      commandeId,
      finalStock: 2,
    })
  })

  it('does not cancel an already paid Stripe session during abandoned cleanup', async () => {
    const { articleId, commandeId, stripeId } = await createOldReservedCheckout(
      'cs_cleanup_already_paid',
    )

    testApp.stripe.setNextExpirationResult({
      status: 'already_paid',
      paymentIntentId: 'pi_cleanup_paid',
    })

    await cleanupAbandoned().expect(201, {
      scanned: 1,
      cancelled: 0,
      skipped: 1,
      failed: 0,
    })

    const [commande, article, releaseMovements, reconciliation] =
      await Promise.all([
        testApp.prisma.commande.findUniqueOrThrow({
          where: { id: commandeId },
        }),
        testApp.prisma.article.findUniqueOrThrow({
          where: { id: articleId },
        }),
        testApp.prisma.mouvementStock.findMany({
          where: { reference: `commande:${commandeId}:reservation:release` },
        }),
        testApp.prisma.stripeCheckoutReconciliation.findFirstOrThrow(),
      ])

    expect(commande.statut).toBe('paiement_en_attente')
    expect(article.stock).toBe(-3)
    expect(releaseMovements).toHaveLength(0)
    expect(reconciliation).toMatchObject({
      commandeId,
      stripeSessionId: stripeId,
      operation: 'review_paid_pending_checkout',
      status: 'pending',
      attempts: 0,
    })
  })

  it('keeps a pending order with no stripeId reserved and records reconciliation', async () => {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: -3,
    })
    const commande = await createPendingCommande(testApp.prisma, {
      articleId: article.id,
      quantite: 5,
      prixUnitCents: 250,
      stripeId: 'cs_cleanup_missing_then_null',
      createdAt: daysAgo(2),
    })
    await testApp.prisma.commande.update({
      where: { id: commande.id },
      data: { stripeId: null },
    })
    await createReservationMovement(article.id, commande.id)

    await cleanupAbandoned().expect(201, {
      scanned: 1,
      cancelled: 0,
      skipped: 1,
      failed: 0,
    })

    const [afterCleanup, updatedArticle, reconciliation] = await Promise.all([
      testApp.prisma.commande.findUniqueOrThrow({
        where: { id: commande.id },
      }),
      testApp.prisma.article.findUniqueOrThrow({
        where: { id: article.id },
      }),
      testApp.prisma.stripeCheckoutReconciliation.findFirstOrThrow(),
    ])

    expect(afterCleanup.statut).toBe('paiement_en_attente')
    expect(updatedArticle.stock).toBe(-3)
    expect(reconciliation).toMatchObject({
      commandeId: commande.id,
      stripeSessionId: `commande:${commande.id}:missing-checkout-session`,
      operation: 'review_missing_checkout_session',
      status: 'pending',
    })
    expect(testApp.stripe.expiredSessions).toHaveLength(0)
  })

  it('rolls back local release if stock restoration fails after Stripe expiration', async () => {
    const { articleId, commandeId } = await createOldReservedCheckout(
      'cs_cleanup_local_failure',
    )

    await installFailingArticleReleaseTrigger()

    try {
      await cleanupAbandoned().expect(201, {
        scanned: 1,
        cancelled: 0,
        skipped: 0,
        failed: 1,
        failures: [
          {
            commandeId,
            reason: 'e2e cleanup release failure',
          },
        ],
      })
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
        testApp.prisma.mouvementStock.findMany({
          where: { reference: `commande:${commandeId}:reservation:release` },
        }),
      ])

    expect(commande.statut).toBe('paiement_en_attente')
    expect(article.stock).toBe(-3)
    expect(releaseOperations).toBe(0)
    expect(releaseMovements).toHaveLength(0)
  })

  async function createOldReservedCheckout(stripeId: string) {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: 2,
    })

    testApp.stripe.setNextSession({
      id: stripeId,
      url: `https://checkout.stripe.test/${stripeId}`,
    })

    await request(testApp.app.getHttpServer())
      .post('/api/commandes/checkout')
      .send({
        nom: 'Client E2E',
        email: 'client.e2e@example.com',
        tel: '0600000000',
        lieu: validPickupPoint,
        dateRetrait: getNextDateForWeekday(2),
        lignes: [{ articleId: article.id, quantite: 5 }],
      })
      .expect(201)

    const commande = await testApp.prisma.commande.findFirstOrThrow()
    await testApp.prisma.commande.update({
      where: { id: commande.id },
      data: { createdAt: daysAgo(2) },
    })

    return {
      articleId: article.id,
      commandeId: commande.id,
      stripeId,
    }
  }

  async function createReservationMovement(
    articleId: number,
    commandeId: number,
  ) {
    await testApp.prisma.mouvementStock.create({
      data: {
        type: 'commande',
        cible: 'article',
        articleId,
        quantite: -5,
        stockAvant: 2,
        stockApres: -3,
        reference: `commande:${commandeId}:reservation`,
      },
    })
  }

  function cleanupAbandoned() {
    return request(testApp.app.getHttpServer())
      .post('/api/commandes/cleanup-abandoned')
      .set(authAs(ROLES.GERANT))
  }

  function startCleanupAbandoned() {
    return new Promise<request.Response>((resolve, reject) => {
      cleanupAbandoned()
        .expect(201)
        .end((error, response) => {
          if (error) {
            reject(error instanceof Error ? error : new Error(String(error)))
            return
          }

          resolve(response)
        })
    })
  }

  function postSignedWebhook(event: { payload: string; signature: string }) {
    return request(testApp.app.getHttpServer())
      .post('/api/commandes/stripe/webhook')
      .set('stripe-signature', event.signature)
      .set('Content-Type', 'application/json')
      .send(event.payload)
  }

  async function expectSingleRelease(data: {
    articleId: number
    commandeId: number
    finalStock: number
  }) {
    const [commande, article, releaseOperations, releaseMovements] =
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
      ])

    expect(commande.statut).toBe('annulee')
    expect(article.stock).toBe(data.finalStock)
    expect(releaseOperations).toBe(1)
    expect(releaseMovements).toHaveLength(1)
  }

  async function installFailingArticleReleaseTrigger() {
    await dropFailingArticleReleaseTrigger()

    await testApp.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION e2e_fail_cleanup_article_release()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."stock" > OLD."stock" THEN
          RAISE EXCEPTION 'e2e cleanup release failure';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    await testApp.prisma.$executeRawUnsafe(`
      CREATE TRIGGER e2e_fail_cleanup_article_release
      BEFORE UPDATE ON "Article"
      FOR EACH ROW
      EXECUTE FUNCTION e2e_fail_cleanup_article_release();
    `)
  }

  async function dropFailingArticleReleaseTrigger() {
    await testApp.prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS e2e_fail_cleanup_article_release ON "Article";
    `)
    await testApp.prisma.$executeRawUnsafe(`
      DROP FUNCTION IF EXISTS e2e_fail_cleanup_article_release();
    `)
  }
})
