import request from 'supertest'
import { ROLES } from '../src/auth/roles'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'
import { truncateBusinessTables } from './helpers/database'
import { authAs } from './helpers/auth'
import { createArticle } from './fixtures/articles'
import {
  daysAgo,
  getNextDateForWeekday,
  validPickupPoint,
} from './fixtures/dates'
import { createPendingCommande } from './fixtures/commandes'

describe('API E2E - authorization and abandoned order cleanup', () => {
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

  it('POST /api/commandes protects direct manual creation by role and keeps preorder stock allowed', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/commandes')
      .send({})
      .expect(401)

    for (const role of [ROLES.PRODUCTION, ROLES.STOCK, ROLES.COMPTABLE]) {
      await request(testApp.app.getHttpServer())
        .post('/api/commandes')
        .set(authAs(role))
        .send({})
        .expect(403)
    }

    const articleForGerant = await createArticle(testApp.prisma, {
      nom: 'Manual gerant',
      prixCents: 400,
      stock: 1,
    })

    await request(testApp.app.getHttpServer())
      .post('/api/commandes')
      .set(authAs(ROLES.GERANT))
      .send(orderPayload(articleForGerant.id, 3))
      .expect(201)

    const gerantArticle = await testApp.prisma.article.findUniqueOrThrow({
      where: { id: articleForGerant.id },
    })
    expect(gerantArticle.stock).toBe(-2)

    const articleForVendeur = await createArticle(testApp.prisma, {
      nom: 'Manual vendeur',
      prixCents: 500,
      stock: 2,
    })

    await request(testApp.app.getHttpServer())
      .post('/api/commandes')
      .set(authAs(ROLES.VENDEUR))
      .send(orderPayload(articleForVendeur.id, 4))
      .expect(201)

    const commandes = await testApp.prisma.commande.findMany({
      include: { lignes: true },
      orderBy: { id: 'asc' },
    })
    const mouvements = await testApp.prisma.mouvementStock.findMany()

    expect(commandes).toHaveLength(2)
    expect(commandes[0]).toMatchObject({
      statut: 'nouvelle',
      totalTtcCents: 1200,
    })
    expect(commandes[0].lignes[0]).toMatchObject({
      articleId: articleForGerant.id,
      quantite: 3,
      prixUnitCents: 400,
    })
    expect(mouvements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          articleId: articleForGerant.id,
          quantite: -3,
          reference: `commande:${commandes[0].id}`,
        }),
        expect.objectContaining({
          articleId: articleForVendeur.id,
          quantite: -4,
          reference: `commande:${commandes[1].id}`,
        }),
      ]),
    )
  })

  it('checks representative protected routes for commandes, stock and caisse', async () => {
    await request(testApp.app.getHttpServer()).get('/api/commandes').expect(401)
    await request(testApp.app.getHttpServer())
      .get('/api/commandes')
      .set(authAs(ROLES.COMPTABLE))
      .expect(200)

    await request(testApp.app.getHttpServer())
      .get('/api/mouvements-stock')
      .expect(401)
    await request(testApp.app.getHttpServer())
      .get('/api/mouvements-stock')
      .set(authAs(ROLES.STOCK))
      .expect(200)
    await request(testApp.app.getHttpServer())
      .post('/api/mouvements-stock/ajustement')
      .set(authAs(ROLES.PRODUCTION))
      .send({})
      .expect(403)

    await request(testApp.app.getHttpServer())
      .get('/api/caisse/today')
      .expect(401)
    await request(testApp.app.getHttpServer())
      .get('/api/caisse/today')
      .set(authAs(ROLES.VENDEUR))
      .expect(200)
    await request(testApp.app.getHttpServer())
      .get('/api/caisse/journees')
      .set(authAs(ROLES.VENDEUR))
      .expect(403)
  })

  it('POST /api/commandes/cleanup-abandoned is gerant-only and releases old reservations once', async () => {
    await request(testApp.app.getHttpServer())
      .post('/api/commandes/cleanup-abandoned')
      .expect(401)

    await request(testApp.app.getHttpServer())
      .post('/api/commandes/cleanup-abandoned')
      .set(authAs(ROLES.VENDEUR))
      .expect(403)

    const oldArticle = await createArticle(testApp.prisma, {
      nom: 'Old pending',
      prixCents: 250,
      stock: -3,
    })
    const recentArticle = await createArticle(testApp.prisma, {
      nom: 'Recent pending',
      prixCents: 250,
      stock: -3,
    })
    const oldCommande = await createPendingCommande(testApp.prisma, {
      articleId: oldArticle.id,
      quantite: 5,
      prixUnitCents: 250,
      stripeId: 'cs_old_pending',
      createdAt: daysAgo(2),
    })
    const recentCommande = await createPendingCommande(testApp.prisma, {
      articleId: recentArticle.id,
      quantite: 5,
      prixUnitCents: 250,
      stripeId: 'cs_recent_pending',
    })

    await testApp.prisma.mouvementStock.createMany({
      data: [
        {
          type: 'commande',
          cible: 'article',
          articleId: oldArticle.id,
          quantite: -5,
          stockAvant: 2,
          stockApres: -3,
          reference: `commande:${oldCommande.id}:reservation`,
        },
        {
          type: 'commande',
          cible: 'article',
          articleId: recentArticle.id,
          quantite: -5,
          stockAvant: 2,
          stockApres: -3,
          reference: `commande:${recentCommande.id}:reservation`,
        },
      ],
    })

    const response = await request(testApp.app.getHttpServer())
      .post('/api/commandes/cleanup-abandoned')
      .set(authAs(ROLES.GERANT))
      .expect(201)

    expect(response.body).toEqual({
      scanned: 1,
      cancelled: 1,
      skipped: 0,
      failed: 0,
    })

    const [oldAfter, recentAfter] = await Promise.all([
      testApp.prisma.commande.findUniqueOrThrow({
        where: { id: oldCommande.id },
        include: { historique: true },
      }),
      testApp.prisma.commande.findUniqueOrThrow({
        where: { id: recentCommande.id },
      }),
    ])
    const oldArticleAfter = await testApp.prisma.article.findUniqueOrThrow({
      where: { id: oldArticle.id },
    })
    const releases = await testApp.prisma.mouvementStock.findMany({
      where: { reference: `commande:${oldCommande.id}:reservation:release` },
    })

    expect(oldAfter.statut).toBe('annulee')
    expect(recentAfter.statut).toBe('paiement_en_attente')
    expect(oldArticleAfter.stock).toBe(2)
    expect(releases).toHaveLength(1)
    expect(oldAfter.historique).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ancienStatut: 'paiement_en_attente',
          nouveauStatut: 'annulee',
          motif: 'commande_abandonnee',
        }),
      ]),
    )
  })
})

function orderPayload(articleId: number, quantite: number) {
  return {
    nom: 'Manual Client',
    email: 'manual.e2e@example.com',
    tel: '0600000000',
    lieu: validPickupPoint,
    dateRetrait: getNextDateForWeekday(2),
    lignes: [{ articleId, quantite }],
  }
}
