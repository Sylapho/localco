import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'
import { pickupPoints } from '../src/commandes/pickup-slots'
import { eurosToCents } from '../src/money'

type SeedMatierePremiere = {
  key: string
  nom: string
  stock: number
  unite: string
  coutUnitaire: number
  seuil: number
  conditionnement: string
}

type SeedArticle = {
  key: string
  nom: string
  prix: number
  description: string
  stock: number
  ingredients?: string
  allergenes?: string | null
  nomenclature?: Array<{
    matiereKey: string
    quantite: number
  }>
}

const matieresPremieres = [
  {
    key: 'whole_chicken',
    nom: 'Poulet entier',
    stock: 80,
    unite: 'piece',
    coutUnitaire: 8.2,
    seuil: 10,
    conditionnement: 'caisse',
  },
  {
    key: 'chicken_breast',
    nom: 'Blanc de poulet',
    stock: 45,
    unite: 'kg',
    coutUnitaire: 9.8,
    seuil: 8,
    conditionnement: 'caisse sous vide',
  },
  {
    key: 'chicken_thigh',
    nom: 'Cuisse de poulet',
    stock: 55,
    unite: 'kg',
    coutUnitaire: 6.4,
    seuil: 8,
    conditionnement: 'caisse sous vide',
  },
  {
    key: 'chicken_wing',
    nom: 'Aile de poulet',
    stock: 30,
    unite: 'kg',
    coutUnitaire: 4.9,
    seuil: 5,
    conditionnement: 'caisse sous vide',
  },
  {
    key: 'chicken_liver',
    nom: 'Foie de volaille',
    stock: 14,
    unite: 'kg',
    coutUnitaire: 4.2,
    seuil: 3,
    conditionnement: 'bac frais',
  },
  {
    key: 'eggs',
    nom: 'Oeufs',
    stock: 240,
    unite: 'piece',
    coutUnitaire: 0.18,
    seuil: 48,
    conditionnement: 'plateau de 30',
  },
  {
    key: 'natural_casing',
    nom: 'Boyau naturel',
    stock: 8,
    unite: 'kg',
    coutUnitaire: 18,
    seuil: 1,
    conditionnement: 'seau',
  },
  {
    key: 'seasoning',
    nom: 'Assaisonnement volailles',
    stock: 12,
    unite: 'kg',
    coutUnitaire: 11,
    seuil: 2,
    conditionnement: 'seau',
  },
  {
    key: 'herbs',
    nom: 'Herbes aromatiques',
    stock: 6,
    unite: 'kg',
    coutUnitaire: 14,
    seuil: 1,
    conditionnement: 'sachet',
  },
  {
    key: 'breadcrumbs',
    nom: 'Panure',
    stock: 18,
    unite: 'kg',
    coutUnitaire: 3.4,
    seuil: 3,
    conditionnement: 'sac',
  },
  {
    key: 'cheese',
    nom: 'Fromage',
    stock: 12,
    unite: 'kg',
    coutUnitaire: 7.5,
    seuil: 2,
    conditionnement: 'bloc',
  },
  {
    key: 'camembert',
    nom: 'Camembert',
    stock: 24,
    unite: 'piece',
    coutUnitaire: 2.1,
    seuil: 6,
    conditionnement: 'carton',
  },
  {
    key: 'bacon',
    nom: 'Bacon',
    stock: 10,
    unite: 'kg',
    coutUnitaire: 8.8,
    seuil: 2,
    conditionnement: 'barquette',
  },
  {
    key: 'chorizo',
    nom: 'Chorizo',
    stock: 8,
    unite: 'kg',
    coutUnitaire: 9.5,
    seuil: 2,
    conditionnement: 'barquette',
  },
] satisfies SeedMatierePremiere[]

const shopArticles = [
  ['gesiers', 'Gésiers de poulet confits', 8.3, '+/- 350 g', 20],
  ['mousse_foie', 'Mousse de foie de volaille', 5.3, 'Pot 180 g', 20],
  ['terrine_normande', 'Terrine de poulet normande', 5.3, 'Pot 200 g', 20],
  ['rillettes', 'Rillettes de poulet', 5.3, 'Pot 200 g', 20],
  [
    'rillettes_piment',
    "Rillettes de poulet piment d'Espelette",
    5.9,
    'Pot 200 g',
    20,
  ],
  ['terrine_thym', 'Terrine de poulet au thym', 5.9, 'Pot 200 g', 20],
  [
    'terrine_noisette',
    'Terrine de poulet noisette',
    5.9,
    'Pot 200 g',
    20,
  ],
  [
    'whole_chicken_small',
    'Poulet prêt à cuire 4/6 personnes',
    15.5,
    '+/- 1,4 à 1,6 kg',
    20,
  ],
  [
    'whole_chicken_medium',
    'Poulet prêt à cuire 6/8 personnes',
    17.5,
    '+/- 1,7 à 1,8 kg',
    20,
  ],
  [
    'whole_chicken_large',
    'Poulet prêt à cuire 8 personnes et plus',
    18.5,
    '+/- 1,9 à 2,1 kg',
    20,
  ],
  ['breast_x2', 'Blanc de poulet x2', 7.5, '+/- 350 g', 20],
  ['breast_x4', 'Blanc de poulet x4', 14, '+/- 700 g', 20],
  ['leg_x2', 'Cuisse entière x2', 8, '+/- 550 g', 20],
  ['leg_x4', 'Cuisse entière x4', 15, '+/- 1,1 kg', 20],
  ['boneless_leg_x2', 'Cuisse désossée x2', 5.5, '+/- 350 g', 20],
  ['thigh_x2', 'Haut de cuisse x2', 4.5, '+/- 500 g', 20],
  ['drumsticks_x2', 'Pilons de poulet x2', 3.3, '+/- 250 g', 20],
  ['wings_x3', 'Ailes de poulet x3', 4, '+/- 400 g', 20],
  ['sausage_nature', 'Saucisse nature x6', 6.5, '+/- 500 g', 20],
  ['sausage_herbs', 'Saucisse aux herbes x6', 6.3, 'Préparation bouchère', 20],
  [
    'sausage_provence',
    'Saucisse provençale x6',
    6.3,
    'Préparation bouchère',
    20,
  ],
  [
    'merguez',
    'Volaille façon merguez x6',
    6.5,
    'Préparation bouchère',
    20,
  ],
  ['paupiette_chorizo', 'Paupiette chorizo x2', 6.5, '+/- 450 g', 20],
  ['paupiette_camembert', 'Paupiette camembert x2', 6.5, '+/- 450 g', 20],
  ['paupiette_bacon', 'Paupiette bacon x2', 6.5, '+/- 450 g', 20],
  ['ballotine_chorizo', 'Ballotine chorizo', 9.5, '+/- 350 g', 20],
  ['ballotine_camembert', 'Ballotine camembert', 9.5, '+/- 350 g', 20],
  ['ballotine_bacon', 'Ballotine bacon', 9.5, '+/- 350 g', 20],
  ['cordon_bleu', 'Cordon bleu x2', 9, '+/- 500 g', 20],
  ['chicken', 'Chicken x6', 7.5, '+/- 400 g', 20],
  ['milanese', 'Escalope milanaise x2', 5.5, '+/- 350 g', 20],
  ['skewer_thym', 'Brochette thym citron x2', 4.5, '+/- 250 g', 20],
  ['skewer_curry', 'Brochette curry coco x2', 4.5, '+/- 250 g', 20],
  ['skewer', 'Brochette x2', 4.5, '+/- 250 g', 20],
  ['eggs_x6', 'Oeufs x6', 2, 'Boîte de 6 oeufs', 40],
  ['eggs_x12', 'Oeufs x12', 3.6, 'Boîte de 12 oeufs', 30],
  ['eggs_x24', 'Oeufs x24', 6.8, 'Plateau de 24 oeufs', 20],
  ['eggs_x30', 'Oeufs x30', 8.2, 'Plateau de 30 oeufs', 20],
  [
    'bbq_pack',
    'BBQ Pack',
    12,
    'Pack grillades : brochettes, saucisses nature, saucisses aux herbes et volaille façon merguez',
    15,
  ],
  [
    'ado_pack',
    'Ado Pack',
    28,
    'Pack grillades familial : brochettes et assortiments de saucisses',
    10,
  ],
  [
    'family_pack',
    'Family Pack',
    40,
    'Grand pack grillades : brochettes, saucisses nature, herbes, provençales et volaille façon merguez',
    8,
  ],
  [
    'maxi_pack',
    'Maxi Pack',
    78,
    'Pack grillades maxi pour grands repas, avec assortiment de brochettes et saucisses',
    5,
  ],
] as const

async function main() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL manquante')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  await resetDatabase(prisma)
  await seedPickupPoints(prisma)
  const matieres = await seedMatieresPremieres(prisma)
  const articles = await seedArticles(prisma, matieres)
  await seedStockLots(prisma, matieres, articles)

  await prisma.$disconnect()
  await pool.end()

  console.log('Seed terminé avec catalogue Les Cocottes, matières premières et lots DLC')
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
  await prisma.pickupPoint.deleteMany()
}

async function seedPickupPoints(prisma: PrismaClient) {
  await prisma.pickupPoint.createMany({
    data: pickupPoints.map((point) => ({
      label: point.label,
      address: point.address ?? point.label,
      schedule: point.schedule,
      allowedWeekdays: [...point.allowedWeekdays],
      alternatingWeekAnchorDate: point.alternatingWeekAnchorDate ?? null,
      active: true,
    })),
    skipDuplicates: true,
  })
}

async function seedMatieresPremieres(prisma: PrismaClient) {
  const seeded = new Map<string, { id: number; stock: number }>()

  for (const matiere of matieresPremieres) {
    const created = await prisma.matierePremiere.create({
      data: {
        nom: matiere.nom,
        stock: matiere.stock,
        unite: matiere.unite,
        coutUnitaireCents: eurosToCents(matiere.coutUnitaire),
        seuil: matiere.seuil,
        conditionnement: matiere.conditionnement,
      },
    })

    seeded.set(matiere.key, {
      id: created.id,
      stock: created.stock,
    })
  }

  return seeded
}

async function seedArticles(
  prisma: PrismaClient,
  matieres: Map<string, { id: number }>,
) {
  const seeded = new Map<string, { id: number; stock: number }>()

  for (const article of buildArticles()) {
    const created = await prisma.article.create({
      data: {
        nom: article.nom,
        category: getShopArticleCategory(article.nom),
        prixCents: eurosToCents(article.prix),
        tvaBps: 550,
        stock: article.stock,
        online: true,
        emoji: getArticleCode(article.nom),
        description: article.description,
        ingredients: article.ingredients ?? getShopArticleIngredients(article.nom),
        allergenes: article.allergenes ?? getShopArticleAllergenes(article.nom),
      },
    })

    seeded.set(article.key, {
      id: created.id,
      stock: created.stock,
    })

    if (!article.nomenclature) continue

    await prisma.nomenclature.createMany({
      data: article.nomenclature.map((line) => {
        const matiere = matieres.get(line.matiereKey)

        if (!matiere) {
          throw new Error(`Matière première introuvable: ${line.matiereKey}`)
        }

        return {
          articleId: created.id,
          mpId: matiere.id,
          quantite: line.quantite,
        }
      }),
    })
  }

  return seeded
}

function buildArticles(): SeedArticle[] {
  return shopArticles.map(([key, nom, prix, description, stock]) => ({
    key,
    nom,
    prix,
    description,
    stock,
    nomenclature: getArticleNomenclature(key),
  }))
}

function getArticleNomenclature(
  key: string,
): SeedArticle['nomenclature'] | undefined {
  if (key.includes('whole_chicken')) {
    return [{ matiereKey: 'whole_chicken', quantite: 1 }]
  }

  if (key.includes('breast')) {
    return [{ matiereKey: 'chicken_breast', quantite: 0.35 }]
  }

  if (key.includes('leg') || key.includes('thigh') || key.includes('drumsticks')) {
    return [{ matiereKey: 'chicken_thigh', quantite: 0.55 }]
  }

  if (key.includes('wings')) {
    return [{ matiereKey: 'chicken_wing', quantite: 0.4 }]
  }

  if (key.includes('eggs_x6')) {
    return [{ matiereKey: 'eggs', quantite: 6 }]
  }

  if (key.includes('eggs_x12')) {
    return [{ matiereKey: 'eggs', quantite: 12 }]
  }

  if (key.includes('eggs_x24')) {
    return [{ matiereKey: 'eggs', quantite: 24 }]
  }

  if (key.includes('eggs_x30')) {
    return [{ matiereKey: 'eggs', quantite: 30 }]
  }

  if (key.includes('mousse_foie')) {
    return [
      { matiereKey: 'chicken_liver', quantite: 0.16 },
      { matiereKey: 'seasoning', quantite: 0.02 },
    ]
  }

  if (
    key.includes('terrine') ||
    key.includes('rillettes') ||
    key.includes('gesiers')
  ) {
    return [
      { matiereKey: 'chicken_thigh', quantite: 0.18 },
      { matiereKey: 'seasoning', quantite: 0.02 },
    ]
  }

  if (key.includes('sausage') || key.includes('merguez')) {
    return [
      { matiereKey: 'chicken_thigh', quantite: 0.5 },
      { matiereKey: 'natural_casing', quantite: 0.03 },
      { matiereKey: key.includes('herbs') ? 'herbs' : 'seasoning', quantite: 0.02 },
    ]
  }

  if (key.includes('camembert')) {
    return [
      { matiereKey: 'chicken_breast', quantite: 0.32 },
      { matiereKey: 'camembert', quantite: 0.25 },
      { matiereKey: 'seasoning', quantite: 0.02 },
    ]
  }

  if (key.includes('bacon')) {
    return [
      { matiereKey: 'chicken_breast', quantite: 0.32 },
      { matiereKey: 'bacon', quantite: 0.08 },
      { matiereKey: 'seasoning', quantite: 0.02 },
    ]
  }

  if (key.includes('chorizo')) {
    return [
      { matiereKey: 'chicken_breast', quantite: 0.32 },
      { matiereKey: 'chorizo', quantite: 0.08 },
      { matiereKey: 'seasoning', quantite: 0.02 },
    ]
  }

  if (key.includes('cordon_bleu')) {
    return [
      { matiereKey: 'chicken_breast', quantite: 0.35 },
      { matiereKey: 'cheese', quantite: 0.08 },
      { matiereKey: 'breadcrumbs', quantite: 0.04 },
    ]
  }

  if (key.includes('chicken') || key.includes('milanese')) {
    return [
      { matiereKey: 'chicken_breast', quantite: 0.35 },
      { matiereKey: 'breadcrumbs', quantite: 0.04 },
      { matiereKey: 'seasoning', quantite: 0.01 },
    ]
  }

  if (key.includes('skewer')) {
    return [
      { matiereKey: 'chicken_breast', quantite: 0.25 },
      { matiereKey: key.includes('thym') ? 'herbs' : 'seasoning', quantite: 0.01 },
    ]
  }

  if (key.includes('pack')) {
    return [
      { matiereKey: 'chicken_breast', quantite: 0.5 },
      { matiereKey: 'chicken_thigh', quantite: 0.5 },
      { matiereKey: 'natural_casing', quantite: 0.03 },
      { matiereKey: 'seasoning', quantite: 0.03 },
    ]
  }

  return undefined
}

async function seedStockLots(
  prisma: PrismaClient,
  matieres: Map<string, { id: number; stock: number }>,
  articles: Map<string, { id: number; stock: number }>,
) {
  const chickenBreast = matieres.get('chicken_breast')
  const chickenThigh = matieres.get('chicken_thigh')
  const eggs = matieres.get('eggs')
  const cordonBleu = articles.get('cordon_bleu')
  const sausageNature = articles.get('sausage_nature')

  await prisma.stockLot.createMany({
    data: [
      chickenBreast
        ? {
            target: 'matiere_premiere',
            mpId: chickenBreast.id,
            initialQuantity: 20,
            remainingQuantity: 20,
            expiresAt: daysFromNow(2),
            reference: 'seed-blanc-poulet-near',
          }
        : null,
      chickenThigh
        ? {
            target: 'matiere_premiere',
            mpId: chickenThigh.id,
            initialQuantity: 25,
            remainingQuantity: 25,
            expiresAt: daysFromNow(5),
            reference: 'seed-cuisse-poulet-ok',
          }
        : null,
      eggs
        ? {
            target: 'matiere_premiere',
            mpId: eggs.id,
            initialQuantity: 120,
            remainingQuantity: 120,
            expiresAt: daysFromNow(14),
            reference: 'seed-oeufs-ok',
          }
        : null,
      cordonBleu
        ? {
            target: 'article',
            articleId: cordonBleu.id,
            initialQuantity: 10,
            remainingQuantity: 10,
            expiresAt: daysFromNow(3),
            reference: 'seed-cordon-bleu-ok',
          }
        : null,
      sausageNature
        ? {
            target: 'article',
            articleId: sausageNature.id,
            initialQuantity: 12,
            remainingQuantity: 12,
            expiresAt: daysFromNow(2),
            reference: 'seed-saucisse-nature-near',
          }
        : null,
    ].filter((lot) => lot !== null),
  })
}

function getShopArticleCategory(nom: string) {
  const lowerName = nom.toLowerCase()

  if (lowerName.includes('pack')) {
    return 'PACKS'
  }

  if (lowerName.includes('oeufs')) {
    return 'EGGS'
  }

  if (
    lowerName.includes('terrine') ||
    lowerName.includes('rillettes') ||
    lowerName.includes('mousse') ||
    lowerName.includes('gésiers') ||
    lowerName.includes('gesiers')
  ) {
    return 'JARS'
  }

  if (lowerName.includes('brochette')) {
    return 'SKEWERS'
  }

  if (
    lowerName.includes('saucisse') ||
    lowerName.includes('merguez') ||
    lowerName.includes('paupiette') ||
    lowerName.includes('ballotine') ||
    lowerName.includes('cordon bleu') ||
    lowerName.includes('chicken') ||
    lowerName.includes('milanaise')
  ) {
    return 'PREPARATIONS'
  }

  return 'CUTS'
}

function getShopArticleIngredients(nom: string) {
  const lowerName = nom.toLowerCase()

  if (lowerName.includes('oeufs')) {
    return 'Oeufs de poules élevées en plein air.'
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

  if (lowerName.includes('oeufs')) {
    allergenes.add('Oeufs')
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

function getArticleCode(nom: string) {
  return nom
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
}

function daysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(12, 0, 0, 0)

  return date
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
