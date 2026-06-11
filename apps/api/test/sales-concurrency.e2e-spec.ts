import request from 'supertest'
import { ROLES } from '../src/auth/roles'
import { createArticle } from './fixtures/articles'
import { authAs } from './helpers/auth'
import { createTestApp, E2eTestApp } from './helpers/create-test-app'
import { truncateBusinessTables } from './helpers/database'

describe('API E2E - concurrent sale creation', () => {
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

  it('allows only one concurrent sale to consume the last stock unit', async () => {
    const article = await createArticle(testApp.prisma, {
      nom: 'Last stock',
      prixCents: 250,
      stock: 1,
    })

    const responses = await Promise.all([
      createSale([{ articleId: article.id, quantite: 1 }]),
      createSale([{ articleId: article.id, quantite: 1 }]),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ])

    const rejected = responses.find((response) => response.status === 409)
    expect(rejected?.body).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    })

    const [articleAfter, ventes, lignes, mouvements] = await Promise.all([
      testApp.prisma.article.findUniqueOrThrow({
        where: { id: article.id },
      }),
      testApp.prisma.vente.findMany(),
      testApp.prisma.ligneVente.findMany(),
      testApp.prisma.mouvementStock.findMany(),
    ])

    expect(articleAfter.stock).toBe(0)
    expect(ventes).toHaveLength(1)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({
      articleId: article.id,
      quantite: 1,
      prixUnitCents: 250,
    })
    expect(mouvements).toHaveLength(1)
    expect(mouvements[0]).toMatchObject({
      type: 'vente',
      articleId: article.id,
      quantite: -1,
      stockAvant: 1,
      stockApres: 0,
      reference: `vente:${ventes[0].id}`,
    })
    expect(articleAfter.stock + soldQuantity(lignes)).toBe(article.stock)
  })

  it('aggregates duplicate sale lines before checking and consuming stock', async () => {
    const article = await createArticle(testApp.prisma, {
      nom: 'Duplicate lines',
      prixCents: 300,
      stock: 5,
    })

    await createSale([
      { articleId: article.id, quantite: 2 },
      { articleId: article.id, quantite: 3 },
    ]).expect(201)

    const [articleAfter, ventes, lignes, mouvements] = await Promise.all([
      testApp.prisma.article.findUniqueOrThrow({
        where: { id: article.id },
      }),
      testApp.prisma.vente.findMany(),
      testApp.prisma.ligneVente.findMany(),
      testApp.prisma.mouvementStock.findMany(),
    ])

    expect(articleAfter.stock).toBe(0)
    expect(ventes).toHaveLength(1)
    expect(lignes).toHaveLength(1)
    expect(lignes[0]).toMatchObject({
      articleId: article.id,
      quantite: 5,
      prixUnitCents: 300,
    })
    expect(mouvements).toHaveLength(1)
    expect(mouvements[0]).toMatchObject({
      articleId: article.id,
      quantite: -5,
      stockAvant: 5,
      stockApres: 0,
    })
  })

  it('rolls back stock, sale lines and movements when sale persistence fails', async () => {
    const article = await createArticle(testApp.prisma, {
      nom: 'Rollback sale',
      prixCents: 250,
      stock: 2,
    })

    await installFailingVenteInsertTrigger()

    try {
      await createSale([{ articleId: article.id, quantite: 1 }]).expect(500)
    } finally {
      await dropFailingVenteInsertTrigger()
    }

    const [articleAfter, ventes, lignes, mouvements] = await Promise.all([
      testApp.prisma.article.findUniqueOrThrow({
        where: { id: article.id },
      }),
      testApp.prisma.vente.findMany(),
      testApp.prisma.ligneVente.findMany(),
      testApp.prisma.mouvementStock.findMany(),
    ])

    expect(articleAfter.stock).toBe(2)
    expect(ventes).toHaveLength(0)
    expect(lignes).toHaveLength(0)
    expect(mouvements).toHaveLength(0)
  })

  it('locks multi-article sales deterministically when payload order is inverted', async () => {
    const firstArticle = await createArticle(testApp.prisma, {
      nom: 'First locked',
      prixCents: 200,
      stock: 1,
    })
    const secondArticle = await createArticle(testApp.prisma, {
      nom: 'Second locked',
      prixCents: 400,
      stock: 1,
    })

    const responses = await Promise.all([
      createSale([
        { articleId: firstArticle.id, quantite: 1 },
        { articleId: secondArticle.id, quantite: 1 },
      ]),
      createSale([
        { articleId: secondArticle.id, quantite: 1 },
        { articleId: firstArticle.id, quantite: 1 },
      ]),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ])

    const [articles, ventes, lignes, mouvements] = await Promise.all([
      testApp.prisma.article.findMany({
        where: { id: { in: [firstArticle.id, secondArticle.id] } },
        orderBy: { id: 'asc' },
      }),
      testApp.prisma.vente.findMany(),
      testApp.prisma.ligneVente.findMany(),
      testApp.prisma.mouvementStock.findMany(),
    ])

    expect(articles.map((article) => article.stock)).toEqual([0, 0])
    expect(ventes).toHaveLength(1)
    expect(lignes).toHaveLength(2)
    expect(mouvements).toHaveLength(2)
    expect(
      articles.reduce((total, article) => total + article.stock, 0) +
        soldQuantity(lignes),
    ).toBe(firstArticle.stock + secondArticle.stock)
  })

  function createSale(
    lignes: Array<{
      articleId: number
      quantite: number
    }>,
  ) {
    return request(testApp.app.getHttpServer())
      .post('/api/ventes')
      .set(authAs(ROLES.VENDEUR))
      .send({
        mode: 'cb',
        lignes,
      })
  }

  async function installFailingVenteInsertTrigger() {
    await testApp.prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION e2e_fail_vente_insert()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'e2e vente insert failure';
      END;
      $$ LANGUAGE plpgsql;
    `)

    await testApp.prisma.$executeRawUnsafe(`
      CREATE TRIGGER e2e_fail_vente_insert
      BEFORE INSERT ON "Vente"
      FOR EACH ROW
      EXECUTE FUNCTION e2e_fail_vente_insert();
    `)
  }

  async function dropFailingVenteInsertTrigger() {
    await testApp.prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS e2e_fail_vente_insert ON "Vente";
    `)
    await testApp.prisma.$executeRawUnsafe(`
      DROP FUNCTION IF EXISTS e2e_fail_vente_insert();
    `)
  }
})

function soldQuantity(lignes: Array<{ quantite: number }>) {
  return lignes.reduce((total, ligne) => total + ligne.quantite, 0)
}
