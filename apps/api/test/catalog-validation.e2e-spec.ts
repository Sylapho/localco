import request from 'supertest'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'
import { truncateBusinessTables } from './helpers/database'
import { createArticle } from './fixtures/articles'
import { getNextDateForWeekday, validPickupPoint } from './fixtures/dates'

describe('API E2E - public catalog and validation', () => {
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

  it('GET /api/boutique/articles returns only online articles without auth', async () => {
    const online = await createArticle(testApp.prisma, {
      nom: 'Online article',
      prixCents: 450,
      stock: -2,
      online: true,
    })
    await createArticle(testApp.prisma, {
      nom: 'Offline article',
      prixCents: 999,
      stock: 10,
      online: false,
    })

    const response = await request(testApp.app.getHttpServer())
      .get('/api/boutique/articles')
      .expect(200)

    expect(response.body).toHaveLength(1)
    expect(response.body[0]).toMatchObject({
      id: online.id,
      nom: 'Online article',
      prixCents: 450,
      stock: -2,
      online: true,
    })
  })

  it.each([
    ['unknown field', { unexpected: true }],
    ['invalid email', { email: 'not-an-email' }],
    ['zero quantity', { lignes: [{ articleId: 1, quantite: 0 }] }],
    ['negative quantity', { lignes: [{ articleId: 1, quantite: -1 }] }],
    ['empty lines', { lignes: [] }],
    ['invalid article id', { lignes: [{ articleId: 'bad', quantite: 1 }] }],
    ['invalid date', { dateRetrait: 'not-a-date' }],
  ])('POST /api/commandes/checkout rejects %s', async (_label, override) => {
    const article = await createArticle(testApp.prisma)
    const payload = {
      nom: 'Client E2E',
      email: 'client.e2e@example.com',
      tel: '0600000000',
      lieu: validPickupPoint,
      dateRetrait: getNextDateForWeekday(2),
      lignes: [{ articleId: article.id, quantite: 1 }],
      ...override,
    }

    await request(testApp.app.getHttpServer())
      .post('/api/commandes/checkout')
      .send(payload)
      .expect(400)

    expect(await testApp.prisma.commande.count()).toBe(0)
    expect(testApp.stripe.createdSessions).toHaveLength(0)
  })
})
