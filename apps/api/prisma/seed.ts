import 'dotenv/config'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client'

async function main() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL manquante')
  }

  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  await prisma.article.deleteMany()

  await prisma.article.createMany({
    data: [
      {
        nom: 'Baguette tradition',
        prix: 1.2,
        stock: 30,
        online: true,
        emoji: '🥖',
        description: 'Baguette tradition croustillante',
      },
      {
        nom: 'Croissant',
        prix: 1.1,
        stock: 20,
        online: true,
        emoji: '🥐',
        description: 'Croissant pur beurre',
      },
      {
        nom: 'Pain au chocolat',
        prix: 1.2,
        stock: 18,
        online: true,
        emoji: '🍫',
        description: 'Pain au chocolat pur beurre',
      },
      {
        nom: 'Flan pâtissier',
        prix: 3.5,
        stock: 6,
        online: true,
        emoji: '🍮',
        description: 'Part de flan maison',
      },
    ],
  })

  await prisma.matierePremiere.createMany({
    data: [
      {
        nom: 'Farine T65',
        stock: 50,
        unite: 'kg',
        coutUnitaire: 1.2,
        seuil: 10,
        conditionnement: 'sac de 25 kg',
      },
      {
        nom: 'Beurre AOP',
        stock: 12,
        unite: 'kg',
        coutUnitaire: 8.5,
        seuil: 4,
        conditionnement: 'plaquette / carton',
      },
      {
        nom: 'Sucre',
        stock: 30,
        unite: 'kg',
        coutUnitaire: 1.6,
        seuil: 8,
        conditionnement: 'sac de 5 kg',
      },
      {
        nom: 'Levure boulangère',
        stock: 3,
        unite: 'kg',
        coutUnitaire: 6.2,
        seuil: 1,
        conditionnement: 'sachet sous vide',
      },
    ],
  })

  await prisma.nomenclature.deleteMany()
  await prisma.matierePremiere.deleteMany()
  await prisma.article.deleteMany()

  const farine = await prisma.matierePremiere.create({
    data: {
      nom: 'Farine T65',
      stock: 50,
      unite: 'kg',
      coutUnitaire: 1.2,
      seuil: 10,
      conditionnement: 'sac de 25 kg',
    },
  })

  const beurre = await prisma.matierePremiere.create({
    data: {
      nom: 'Beurre AOP',
      stock: 12,
      unite: 'kg',
      coutUnitaire: 8.5,
      seuil: 4,
      conditionnement: 'carton',
    },
  })

  const levure = await prisma.matierePremiere.create({
    data: {
      nom: 'Levure boulangère',
      stock: 3,
      unite: 'kg',
      coutUnitaire: 6.2,
      seuil: 1,
      conditionnement: 'sachet sous vide',
    },
  })

  const sucre = await prisma.matierePremiere.create({
    data: {
      nom: 'Sucre',
      stock: 30,
      unite: 'kg',
      coutUnitaire: 1.6,
      seuil: 8,
      conditionnement: 'sac de 5 kg',
    },
  })

  const baguette = await prisma.article.create({
    data: {
      nom: 'Baguette tradition',
      prix: 1.2,
      stock: 30,
      online: true,
      emoji: '🥖',
      description: 'Baguette tradition croustillante',
    },
  })

  const croissant = await prisma.article.create({
    data: {
      nom: 'Croissant',
      prix: 1.1,
      stock: 20,
      online: true,
      emoji: '🥐',
      description: 'Croissant pur beurre',
    },
  })

  const painChocolat = await prisma.article.create({
    data: {
      nom: 'Pain au chocolat',
      prix: 1.2,
      stock: 18,
      online: true,
      emoji: '🍫',
      description: 'Pain au chocolat pur beurre',
    },
  })

  await prisma.nomenclature.createMany({
    data: [
      {
        articleId: baguette.id,
        mpId: farine.id,
        quantite: 0.35,
      },
      {
        articleId: baguette.id,
        mpId: levure.id,
        quantite: 0.01,
      },
      {
        articleId: croissant.id,
        mpId: farine.id,
        quantite: 0.08,
      },
      {
        articleId: croissant.id,
        mpId: beurre.id,
        quantite: 0.04,
      },
      {
        articleId: croissant.id,
        mpId: sucre.id,
        quantite: 0.01,
      },
      {
        articleId: painChocolat.id,
        mpId: farine.id,
        quantite: 0.08,
      },
      {
        articleId: painChocolat.id,
        mpId: beurre.id,
        quantite: 0.04,
      },
      {
        articleId: painChocolat.id,
        mpId: sucre.id,
        quantite: 0.015,
      },
    ],
  })

  await prisma.$disconnect()
  await pool.end()

  console.log('Seed terminé')
}

main().catch(async (e) => {
  console.error(e)
  process.exit(1)
})