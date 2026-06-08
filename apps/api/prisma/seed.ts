import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'
import { calculateHtFromTtcCents, eurosToCents } from '../src/money'

type SeedArticle = {
  id: number
  nom: string
  prixCents: number
  tvaBps: number
  nomen: {
    quantite: number
    mp: {
      coutUnitaireCents: number
    }
  }[]
}

type SeedMatiere = {
  id: number
  nom: string
  stock: number
  unite: string
}

type SeedCatalogue = {
  articles: Record<string, SeedArticle>
  matieres: Record<string, SeedMatiere>
}

type SaleLineSeed = {
  article: SeedArticle
  quantite: number
}

type SaleSeed = {
  date: Date
  mode: 'cb' | 'especes' | 'cheque'
  remiseCents: number
  lignes: SaleLineSeed[]
}

const TIME_ZONE = 'Europe/Paris'

async function main() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL manquante')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  await resetDatabase(prisma)

  const catalogue = await seedCatalogue(prisma)
  await seedStockLots(prisma, catalogue)
  await seedSalesHistory(prisma, catalogue.articles)

  await prisma.$disconnect()
  await pool.end()

  console.log(
    'Seed terminé avec catalogue, ventes, lots DLC et historique de caisse',
  )
}

async function resetDatabase(prisma: PrismaClient) {
  await prisma.journeeCaisse.deleteMany()
  await prisma.ligneVente.deleteMany()
  await prisma.vente.deleteMany()
  await prisma.ligneCommande.deleteMany()
  await prisma.commande.deleteMany()
  await prisma.mouvementStock.deleteMany()
  await prisma.stockLot.deleteMany()
  await prisma.nomenclature.deleteMany()
  await prisma.matierePremiere.deleteMany()
  await prisma.article.deleteMany()
}

async function seedCatalogue(prisma: PrismaClient): Promise<SeedCatalogue> {
  const farine = await prisma.matierePremiere.create({
    data: {
      nom: 'Farine T65',
      stock: 80,
      unite: 'kg',
      coutUnitaireCents: eurosToCents(1.2),
      seuil: 10,
      conditionnement: 'sac de 25 kg',
    },
  })

  const beurre = await prisma.matierePremiere.create({
    data: {
      nom: 'Beurre AOP',
      stock: 25,
      unite: 'kg',
      coutUnitaireCents: eurosToCents(8.5),
      seuil: 4,
      conditionnement: 'carton',
    },
  })

  const levure = await prisma.matierePremiere.create({
    data: {
      nom: 'Levure boulangere',
      stock: 6,
      unite: 'kg',
      coutUnitaireCents: eurosToCents(6.2),
      seuil: 1,
      conditionnement: 'sachet sous vide',
    },
  })

  const sucre = await prisma.matierePremiere.create({
    data: {
      nom: 'Sucre',
      stock: 40,
      unite: 'kg',
      coutUnitaireCents: eurosToCents(1.6),
      seuil: 8,
      conditionnement: 'sac de 5 kg',
    },
  })

  const lait = await prisma.matierePremiere.create({
    data: {
      nom: 'Lait entier',
      stock: 35,
      unite: 'L',
      coutUnitaireCents: eurosToCents(0.95),
      seuil: 8,
      conditionnement: 'brique',
    },
  })

  const baguette = await prisma.article.create({
    data: {
      nom: 'Baguette tradition',
      prixCents: eurosToCents(1.2),
      tvaBps: 550,
      stock: 120,
      online: false,
      emoji: 'BT',
      description: 'Baguette tradition croustillante',
    },
  })

  const croissant = await prisma.article.create({
    data: {
      nom: 'Croissant',
      prixCents: eurosToCents(1.1),
      tvaBps: 550,
      stock: 90,
      online: false,
      emoji: 'CR',
      description: 'Croissant pur beurre',
    },
  })

  const painChocolat = await prisma.article.create({
    data: {
      nom: 'Pain au chocolat',
      prixCents: eurosToCents(1.2),
      tvaBps: 550,
      stock: 80,
      online: false,
      emoji: 'PC',
      description: 'Pain au chocolat pur beurre',
    },
  })

  const flan = await prisma.article.create({
    data: {
      nom: 'Flan patissier',
      prixCents: eurosToCents(3.5),
      tvaBps: 550,
      stock: 25,
      online: false,
      emoji: 'FL',
      description: 'Part de flan maison',
    },
  })

  await seedShopCatalogue(prisma)

  await prisma.nomenclature.createMany({
    data: [
      { articleId: baguette.id, mpId: farine.id, quantite: 0.35 },
      { articleId: baguette.id, mpId: levure.id, quantite: 0.01 },
      { articleId: croissant.id, mpId: farine.id, quantite: 0.08 },
      { articleId: croissant.id, mpId: beurre.id, quantite: 0.04 },
      { articleId: croissant.id, mpId: sucre.id, quantite: 0.01 },
      { articleId: painChocolat.id, mpId: farine.id, quantite: 0.08 },
      { articleId: painChocolat.id, mpId: beurre.id, quantite: 0.04 },
      { articleId: painChocolat.id, mpId: sucre.id, quantite: 0.015 },
      { articleId: flan.id, mpId: lait.id, quantite: 0.2 },
      { articleId: flan.id, mpId: sucre.id, quantite: 0.04 },
    ],
  })

  const seededArticles = await prisma.article.findMany({
    include: {
      nomen: {
        include: {
          mp: true,
        },
      },
    },
    orderBy: {
      nom: 'asc',
    },
  })

  return {
    articles: {
      baguette: seededArticles.find((article) => article.id === baguette.id)!,
      croissant: seededArticles.find((article) => article.id === croissant.id)!,
      painChocolat: seededArticles.find(
        (article) => article.id === painChocolat.id,
      )!,
      flan: seededArticles.find((article) => article.id === flan.id)!,
    },
    matieres: {
      farine,
      beurre,
      levure,
      sucre,
      lait,
    },
  }
}

async function seedShopCatalogue(prisma: PrismaClient) {
  const shopArticles = [
    ['Gésiers de poulet confits', 8.3, '+/- 350 g'],
    ['Mousse de foie de volaille', 5.3, 'Pot 180 g'],
    ['Terrine de poulet normande', 5.3, 'Pot 200 g'],
    ['Rillettes de poulet', 5.3, 'Pot 200 g'],
    ["Rillettes de poulet piment d'Espelette", 5.9, 'Pot 200 g'],
    ['Terrine de poulet au thym', 5.9, 'Pot 200 g'],
    ['Terrine de poulet noisette', 5.9, 'Pot 200 g'],
    ['Poulet prêt à cuire 4/6 personnes', 15.5, '+/- 1,4 à 1,6 kg'],
    ['Poulet prêt à cuire 6/8 personnes', 17.5, '+/- 1,7 à 1,8 kg'],
    ['Poulet prêt à cuire 8 personnes et plus', 18.5, '+/- 1,9 à 2,1 kg'],
    ['Blanc de poulet x2', 7.5, '+/- 350 g'],
    ['Blanc de poulet x4', 14, '+/- 700 g'],
    ['Cuisse entière x2', 8, '+/- 550 g'],
    ['Cuisse entière x4', 15, '+/- 1,1 kg'],
    ['Cuisse désossée x2', 5.5, '+/- 350 g'],
    ['Haut de cuisse x2', 4.5, '+/- 500 g'],
    ['Pilons de poulet x2', 3.3, '+/- 250 g'],
    ['Ailes de poulet x3', 4, '+/- 400 g'],
    ['Saucisse nature x6', 6.5, '+/- 500 g'],
    ['Saucisse aux herbes x6', 6.3, 'Préparation bouchère'],
    ['Saucisse provençale x6', 6.3, 'Préparation bouchère'],
    ['Volaille façon merguez x6', 6.5, 'Préparation bouchère'],
    ['Paupiette chorizo x2', 6.5, '+/- 450 g'],
    ['Paupiette camembert x2', 6.5, '+/- 450 g'],
    ['Paupiette bacon x2', 6.5, '+/- 450 g'],
    ['Ballotine chorizo', 9.5, '+/- 350 g'],
    ['Ballotine camembert', 9.5, '+/- 350 g'],
    ['Ballotine bacon', 9.5, '+/- 350 g'],
    ['Cordon bleu x2', 9, '+/- 500 g'],
    ['Chicken x6', 7.5, '+/- 400 g'],
    ['Escalope milanaise x2', 5.5, '+/- 350 g'],
    ['Brochette thym citron x2', 4.5, '+/- 250 g'],
    ['Brochette curry coco x2', 4.5, '+/- 250 g'],
    ['Brochette x2', 4.5, '+/- 250 g'],
    ['Œufs x6', 2, 'Boîte de 6 œufs'],
    ['Œufs x12', 3.6, 'Boîte de 12 œufs'],
    ['Œufs x24', 6.8, 'Plateau de 24 œufs'],
    ['Œufs x30', 8.2, 'Plateau de 30 œufs'],
    [
      'BBQ Pack',
      12,
      'Pack grillades : brochettes, saucisses nature, saucisses aux herbes et volaille façon merguez',
    ],
    [
      'Ado Pack',
      28,
      'Pack grillades familial : brochettes et assortiments de saucisses',
    ],
    [
      'Family Pack',
      40,
      'Grand pack grillades : brochettes, saucisses nature, herbes, provençales et volaille façon merguez',
    ],
    [
      'Maxi Pack',
      78,
      'Pack grillades maxi pour grands repas, avec assortiment de brochettes et saucisses',
    ],
  ] as const

  await prisma.article.createMany({
    data: shopArticles.map(([nom, prix, description]) => ({
      nom,
      prixCents: eurosToCents(prix),
      tvaBps: 550,
      stock: nom === 'Maxi Pack' ? 10 : 20,
      online: true,
      emoji: nom
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 3)
        .toUpperCase(),
      description,
      ingredients: getShopArticleIngredients(nom),
      allergenes: getShopArticleAllergenes(nom),
    })),
  })
}

function getShopArticleIngredients(nom: string) {
  const lowerName = nom.toLowerCase()

  if (lowerName.includes('œufs')) {
    return 'Œufs de poules élevées en plein air.'
  }

  if (lowerName.includes('pack')) {
    return 'Assortiment de volailles, saucisses et brochettes.'
  }

  if (lowerName.includes('camembert')) {
    return 'Volaille, camembert, assaisonnement.'
  }

  if (lowerName.includes('bacon')) {
    return 'Volaille, bacon, assaisonnement.'
  }

  if (lowerName.includes('chorizo')) {
    return 'Volaille, chorizo, assaisonnement.'
  }

  if (lowerName.includes('cordon bleu')) {
    return 'Volaille, fromage, panure.'
  }

  if (lowerName.includes('milanaise') || lowerName.includes('chicken')) {
    return 'Volaille, panure, assaisonnement.'
  }

  if (lowerName.includes('brochette')) {
    return 'Volaille marinée, assaisonnement.'
  }

  if (lowerName.includes('saucisse') || lowerName.includes('merguez')) {
    return 'Volaille, assaisonnement.'
  }

  if (
    lowerName.includes('terrine') ||
    lowerName.includes('rillettes') ||
    lowerName.includes('mousse') ||
    lowerName.includes('gésiers')
  ) {
    return 'Volaille, assaisonnement.'
  }

  return 'Volaille.'
}

function getShopArticleAllergenes(nom: string) {
  const lowerName = nom.toLowerCase()
  const allergenes = new Set<string>()

  if (lowerName.includes('œufs')) {
    allergenes.add('Œufs')
  }

  if (
    lowerName.includes('camembert') ||
    lowerName.includes('cordon bleu') ||
    lowerName.includes('fromage')
  ) {
    allergenes.add('Lait')
  }

  if (
    lowerName.includes('cordon bleu') ||
    lowerName.includes('milanaise') ||
    lowerName.includes('chicken')
  ) {
    allergenes.add('Gluten')
  }

  return allergenes.size > 0 ? Array.from(allergenes).join(', ') : null
}

async function seedStockLots(prisma: PrismaClient, catalogue: SeedCatalogue) {
  const { articles, matieres } = catalogue

  await prisma.stockLot.createMany({
    data: [
      {
        target: 'matiere_premiere',
        mpId: matieres.lait.id,
        initialQuantity: 5,
        remainingQuantity: 4,
        expiresAt: daysFromNow(-1),
        reference: 'seed-lait-expired',
      },
      {
        target: 'matiere_premiere',
        mpId: matieres.levure.id,
        initialQuantity: 2,
        remainingQuantity: 1,
        expiresAt: daysFromNow(1),
        reference: 'seed-levure-urgent',
      },
      {
        target: 'matiere_premiere',
        mpId: matieres.beurre.id,
        initialQuantity: 8,
        remainingQuantity: 6,
        expiresAt: daysFromNow(2),
        reference: 'seed-beurre-near',
      },
      {
        target: 'matiere_premiere',
        mpId: matieres.farine.id,
        initialQuantity: 35,
        remainingQuantity: 35,
        expiresAt: daysFromNow(20),
        reference: 'seed-farine-ok',
      },
      {
        target: 'article',
        articleId: articles.flan.id,
        initialQuantity: 4,
        remainingQuantity: 3,
        expiresAt: daysFromNow(-1),
        reference: 'seed-flan-expired',
      },
      {
        target: 'article',
        articleId: articles.baguette.id,
        initialQuantity: 25,
        remainingQuantity: 18,
        expiresAt: daysFromNow(1),
        reference: 'seed-baguette-urgent',
      },
      {
        target: 'article',
        articleId: articles.croissant.id,
        initialQuantity: 15,
        remainingQuantity: 12,
        expiresAt: daysFromNow(2),
        reference: 'seed-croissant-near',
      },
      {
        target: 'article',
        articleId: articles.painChocolat.id,
        initialQuantity: 20,
        remainingQuantity: 20,
        expiresAt: daysFromNow(5),
        reference: 'seed-pain-chocolat-ok',
      },
    ],
  })
}

async function seedSalesHistory(
  prisma: PrismaClient,
  articles: Record<string, SeedArticle>,
) {
  const now = new Date()
  const history = [
    {
      daysAgo: 5,
      sales: [
        createSaleSeed(now, 5, 8, 'cb', 0, [
          { article: articles.baguette, quantite: 12 },
          { article: articles.croissant, quantite: 6 },
        ]),
        createSaleSeed(now, 5, 12, 'especes', 0, [
          { article: articles.painChocolat, quantite: 5 },
          { article: articles.flan, quantite: 2 },
        ]),
        createSaleSeed(now, 5, 17, 'cb', 1, [
          { article: articles.baguette, quantite: 10 },
          { article: articles.croissant, quantite: 4 },
        ]),
      ],
    },
    {
      daysAgo: 4,
      sales: [
        createSaleSeed(now, 4, 9, 'cb', 0, [
          { article: articles.baguette, quantite: 18 },
          { article: articles.painChocolat, quantite: 8 },
        ]),
        createSaleSeed(now, 4, 14, 'cheque', 0, [
          { article: articles.flan, quantite: 3 },
          { article: articles.croissant, quantite: 7 },
        ]),
      ],
    },
    {
      daysAgo: 3,
      sales: [
        createSaleSeed(now, 3, 8, 'especes', 0, [
          { article: articles.baguette, quantite: 9 },
          { article: articles.croissant, quantite: 10 },
        ]),
        createSaleSeed(now, 3, 13, 'cb', 0.5, [
          { article: articles.painChocolat, quantite: 6 },
          { article: articles.flan, quantite: 4 },
        ]),
        createSaleSeed(now, 3, 18, 'cb', 0, [
          { article: articles.baguette, quantite: 15 },
        ]),
      ],
    },
    {
      daysAgo: 2,
      sales: [
        createSaleSeed(now, 2, 10, 'cb', 0, [
          { article: articles.baguette, quantite: 22 },
          { article: articles.croissant, quantite: 8 },
        ]),
        createSaleSeed(now, 2, 16, 'especes', 0, [
          { article: articles.painChocolat, quantite: 7 },
          { article: articles.flan, quantite: 2 },
        ]),
      ],
    },
    {
      daysAgo: 1,
      sales: [
        createSaleSeed(now, 1, 8, 'cb', 0, [
          { article: articles.baguette, quantite: 16 },
          { article: articles.croissant, quantite: 12 },
        ]),
        createSaleSeed(now, 1, 12, 'especes', 1, [
          { article: articles.painChocolat, quantite: 9 },
          { article: articles.flan, quantite: 3 },
        ]),
        createSaleSeed(now, 1, 18, 'cheque', 0, [
          { article: articles.baguette, quantite: 8 },
          { article: articles.flan, quantite: 2 },
        ]),
      ],
    },
  ]

  for (const day of history) {
    const sales: Awaited<ReturnType<typeof createVente>>[] = []

    for (const sale of day.sales) {
      sales.push(await createVente(prisma, sale))
    }

    await createClosedCashDay(prisma, day.sales[0].date, sales)
  }
}

function createSaleSeed(
  baseDate: Date,
  daysAgo: number,
  hour: number,
  mode: SaleSeed['mode'],
  remise: number,
  lignes: SaleLineSeed[],
): SaleSeed {
  const date = new Date(baseDate)
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, 30, 0, 0)

  return {
    date,
    mode,
    remiseCents: eurosToCents(remise),
    lignes,
  }
}

function daysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(12, 0, 0, 0)

  return date
}

async function createVente(prisma: PrismaClient, sale: SaleSeed) {
  const lignesCalculees = sale.lignes.map((ligne) => {
    const totalLigneTtcCents = ligne.article.prixCents * ligne.quantite
    const totalLigneHtCents = calculateHtFromTtcCents(
      totalLigneTtcCents,
      ligne.article.tvaBps,
    )

    return {
      article: ligne.article,
      quantite: ligne.quantite,
      prixUnitCents: ligne.article.prixCents,
      totalLigneTtcCents,
      totalLigneHtCents,
    }
  })

  const totalAvantRemiseTtcCents = lignesCalculees.reduce(
    (total, ligne) => total + ligne.totalLigneTtcCents,
    0,
  )
  const totalTtcCents = Math.max(
    0,
    totalAvantRemiseTtcCents - sale.remiseCents,
  )
  const totalAvantRemiseHtCents = lignesCalculees.reduce(
    (total, ligne) => total + ligne.totalLigneHtCents,
    0,
  )
  const totalHtCents =
    totalAvantRemiseTtcCents > 0
      ? Math.round(
          (totalAvantRemiseHtCents * totalTtcCents) /
            totalAvantRemiseTtcCents,
        )
      : totalAvantRemiseHtCents
  const tvaCents = totalTtcCents - totalHtCents

  return prisma.vente.create({
    data: {
      date: sale.date,
      mode: sale.mode,
      remiseCents: sale.remiseCents,
      totalTtcCents,
      totalHtCents,
      tvaCents,
      lignes: {
        create: lignesCalculees.map((ligne) => ({
          articleId: ligne.article.id,
          quantite: ligne.quantite,
          prixUnitCents: ligne.prixUnitCents,
          tvaBps: ligne.article.tvaBps,
        })),
      },
    },
    include: {
      lignes: {
        include: {
          article: {
            include: {
              nomen: {
                include: {
                  mp: true,
                },
              },
            },
          },
        },
      },
    },
  })
}

async function createClosedCashDay(
  prisma: PrismaClient,
  date: Date,
  ventes: Awaited<ReturnType<typeof createVente>>[],
) {
  const dayStart = getParisDayStart(date)

  const totals = ventes.reduce(
    (acc, vente) => {
      const coutMatieres = vente.lignes.reduce((venteCost, ligne) => {
        const coutUnitaireCents = ligne.article.nomen.reduce(
          (lineCost, nomenclatureLine) =>
            lineCost +
            Math.round(
              nomenclatureLine.quantite *
                nomenclatureLine.mp.coutUnitaireCents,
            ),
          0,
        )

        return venteCost + coutUnitaireCents * ligne.quantite
      }, 0)

      return {
        totalTtcCents: acc.totalTtcCents + vente.totalTtcCents,
        totalHtCents: acc.totalHtCents + vente.totalHtCents,
        tvaCents: acc.tvaCents + vente.tvaCents,
        especesCents:
          acc.especesCents +
          (vente.mode === 'especes' ? vente.totalTtcCents : 0),
        cbCents:
          acc.cbCents + (vente.mode === 'cb' ? vente.totalTtcCents : 0),
        chequesCents:
          acc.chequesCents +
          (vente.mode === 'cheque' ? vente.totalTtcCents : 0),
        margeCents: acc.margeCents + (vente.totalHtCents - coutMatieres),
        nbVentes: acc.nbVentes + 1,
      }
    },
    {
      totalTtcCents: 0,
      totalHtCents: 0,
      tvaCents: 0,
      especesCents: 0,
      cbCents: 0,
      chequesCents: 0,
      margeCents: 0,
      nbVentes: 0,
    },
  )

  await prisma.journeeCaisse.create({
    data: {
      date: dayStart,
      clotureeA: new Date(dayStart.getTime() + 18 * 60 * 60 * 1000),
      ...totals,
    },
  })
}

function getParisDayStart(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  const offset = getTimeZoneOffsetMs(utcGuess, TIME_ZONE)

  return new Date(utcGuess.getTime() - offset)
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const getPart = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value)
  const asUtc = Date.UTC(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    getPart('hour') % 24,
    getPart('minute'),
    getPart('second'),
  )

  return asUtc - date.getTime()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
