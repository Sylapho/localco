import request from 'supertest'
import { ROLES } from '../src/auth/roles'
import { createArticle } from './fixtures/articles'
import { getNextDateForWeekday, validPickupPoint } from './fixtures/dates'
import { authAs } from './helpers/auth'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'
import { truncateBusinessTables } from './helpers/database'

describe('API E2E - atomic order status transitions', () => {
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
    await dropTransitionGate()
    await testApp.app.close()
  })

  it('serializes incompatible concurrent status transitions and returns 409 to the loser', async () => {
    const { articleId, commandeId } = await createPreparedCommande()
    const lockKey = 812_408
    const gateReady = createDeferred<void>()
    const gateRelease = createDeferred<void>()

    await installTransitionGate(commandeId, lockKey)

    const gateTransaction = testApp.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})`)
        gateReady.resolve()
        await gateRelease.promise
      },
      { timeout: 15_000 },
    )

    await gateReady.promise

    const firstTransition = Promise.resolve(updateStatus(commandeId, 'traitee'))

    await waitForAdvisoryLockWaiter()

    const secondTransition = Promise.resolve(
      updateStatus(commandeId, 'annulee'),
    )

    gateRelease.resolve()
    await gateTransaction

    const [firstResponse, secondResponse] = await Promise.all([
      firstTransition,
      secondTransition,
    ])

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(409)

    const [commande, histories, article, releaseOperations, releaseMovements] =
      await Promise.all([
        testApp.prisma.commande.findUniqueOrThrow({
          where: { id: commandeId },
        }),
        testApp.prisma.commandeStatutHistorique.findMany({
          where: { commandeId },
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

    expect(commande.statut).toBe('traitee')
    expect(article.stock).toBe(3)
    expect(histories).toEqual([
      expect.objectContaining({
        ancienStatut: 'preparee',
        nouveauStatut: 'traitee',
        motif: 'statut_modifie',
      }),
    ])
    expect(releaseOperations).toBe(0)
    expect(releaseMovements).toBe(0)
  })

  async function createPreparedCommande() {
    const article = await createArticle(testApp.prisma, {
      prixCents: 250,
      stock: 3,
    })

    const commande = await testApp.prisma.commande.create({
      data: {
        nom: 'Client E2E',
        email: 'client.e2e@example.com',
        tel: '0600000000',
        lieu: validPickupPoint,
        dateRetrait: new Date(getNextDateForWeekday(2)),
        totalTtcCents: 750,
        statut: 'preparee',
        lignes: {
          create: [
            {
              articleId: article.id,
              quantite: 3,
              prixUnitCents: 250,
            },
          ],
        },
      },
    })

    return {
      articleId: article.id,
      commandeId: commande.id,
    }
  }

  function updateStatus(commandeId: number, statut: 'traitee' | 'annulee') {
    return request(testApp.app.getHttpServer())
      .patch(`/api/commandes/${commandeId}/statut`)
      .set(authAs(ROLES.GERANT))
      .send({ statut })
  }

  async function installTransitionGate(commandeId: number, lockKey: number) {
    await dropTransitionGate()

    await testApp.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION e2e_wait_order_status_transition()
      RETURNS trigger AS $$
      BEGIN
        IF OLD."id" = ${commandeId}
          AND OLD."statut" = 'preparee'
          AND NEW."statut" <> OLD."statut"
        THEN
          PERFORM pg_advisory_lock(${lockKey});
          PERFORM pg_advisory_unlock(${lockKey});
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    await testApp.prisma.$executeRawUnsafe(`
      CREATE TRIGGER e2e_wait_order_status_transition
      BEFORE UPDATE OF "statut" ON "Commande"
      FOR EACH ROW
      EXECUTE FUNCTION e2e_wait_order_status_transition();
    `)
  }

  async function dropTransitionGate() {
    await testApp.prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS e2e_wait_order_status_transition ON "Commande";
    `)
    await testApp.prisma.$executeRawUnsafe(`
      DROP FUNCTION IF EXISTS e2e_wait_order_status_transition();
    `)
  }

  async function waitForAdvisoryLockWaiter() {
    await waitForDatabaseCondition(async () => {
      const rows = await testApp.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM pg_stat_activity
        WHERE wait_event_type = 'Lock'
          AND wait_event = 'advisory'
      `

      return Number(rows[0]?.count ?? 0) > 0
    })
  }
})

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

async function waitForDatabaseCondition(
  condition: () => Promise<boolean>,
  timeoutMs = 5_000,
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  throw new Error('Timed out waiting for database condition')
}
