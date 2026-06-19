import test from 'node:test'
import assert from 'node:assert/strict'
import type { Article, Commande, CommandeStatut, LigneCommande } from './api'
import {
  aggregatePreparationLines,
  getPreparationCommandes,
  groupPreparationCommandes,
  resolvePreparationDateSelection,
} from './preparation'

function makeArticle(id: number, nom: string): Article {
  return {
    id,
    nom,
    prixCents: 300,
    tvaBps: 550,
    stock: 10,
    online: true,
    createdAt: '2026-06-19T08:00:00.000Z',
    updatedAt: '2026-06-19T08:00:00.000Z',
  }
}

function makeLine(
  commandeId: number,
  articleId: number,
  articleNom: string,
  quantite: number,
): LigneCommande {
  return {
    id: commandeId * 100 + articleId,
    commandeId,
    articleId,
    quantite,
    prixUnitCents: 300,
    article: makeArticle(articleId, articleNom),
  }
}

function makeCommande(data: {
  id: number
  statut?: CommandeStatut
  lieu?: string
  dateRetrait?: string | null
  lignes: LigneCommande[]
}): Commande {
  return {
    id: data.id,
    nom: `Client ${data.id}`,
    email: `client${data.id}@example.fr`,
    totalTtcCents: 1200,
    lieu: data.lieu ?? 'Marché de Gaillon',
    dateRetrait: data.dateRetrait ?? '2026-06-19T10:00:00.000Z',
    statut: data.statut ?? 'nouvelle',
    createdAt: `2026-06-18T08:0${data.id}:00.000Z`,
    lignes: data.lignes,
  }
}

test('aggregatePreparationLines sums quantities by product', () => {
  const commandes = [
    makeCommande({
      id: 1,
      lignes: [
        makeLine(1, 1, 'Œufs x6', 2),
        makeLine(1, 2, 'Pain complet', 1),
      ],
    }),
    makeCommande({
      id: 2,
      lignes: [makeLine(2, 1, 'Œufs x6', 3)],
    }),
  ]

  assert.deepEqual(aggregatePreparationLines(commandes), [
    {
      articleId: 1,
      articleNom: 'Œufs x6',
      quantity: 5,
      commandeIds: [1, 2],
    },
    {
      articleId: 2,
      articleNom: 'Pain complet',
      quantity: 1,
      commandeIds: [1],
    },
  ])
})

test('getPreparationCommandes keeps only preparation statuses and filters date and pickup point', () => {
  const tomorrow = resolvePreparationDateSelection(
    'tomorrow',
    new Date('2026-06-19T08:00:00.000Z'),
  )
  const commandes = [
    makeCommande({
      id: 1,
      dateRetrait: '2026-06-20T10:00:00.000Z',
      lieu: 'Marché de Gaillon',
      lignes: [makeLine(1, 1, 'Œufs x6', 2)],
    }),
    makeCommande({
      id: 2,
      dateRetrait: '2026-06-20T12:00:00.000Z',
      lieu: 'Boutique',
      lignes: [makeLine(2, 1, 'Œufs x6', 1)],
    }),
    makeCommande({
      id: 3,
      statut: 'traitee',
      dateRetrait: '2026-06-20T10:00:00.000Z',
      lieu: 'Marché de Gaillon',
      lignes: [makeLine(3, 1, 'Œufs x6', 5)],
    }),
  ]

  const filtered = getPreparationCommandes(commandes, {
    dateKey: tomorrow.dateKey,
    pickupPoint: 'Marché de Gaillon',
  })

  assert.deepEqual(
    filtered.map((commande) => commande.id),
    [1],
  )
})

test('groupPreparationCommandes groups by pickup point inside each pickup date', () => {
  const commandes = [
    makeCommande({
      id: 2,
      lieu: 'Boutique',
      dateRetrait: '2026-06-20T12:00:00.000Z',
      lignes: [makeLine(2, 1, 'Œufs x6', 4)],
    }),
    makeCommande({
      id: 1,
      lieu: 'Marché de Gaillon',
      dateRetrait: '2026-06-19T10:00:00.000Z',
      lignes: [makeLine(1, 2, 'Pain complet', 2)],
    }),
    makeCommande({
      id: 3,
      lieu: 'Boutique',
      dateRetrait: '2026-06-20T13:00:00.000Z',
      lignes: [makeLine(3, 1, 'Œufs x6', 1)],
    }),
  ]

  const groups = groupPreparationCommandes(commandes)

  assert.deepEqual(
    groups.map((group) => ({
      dateKey: group.dateKey,
      pickupPoints: group.pickupGroups.map((pickupGroup) => ({
        pickupPoint: pickupGroup.pickupPoint,
        commandeIds: pickupGroup.commandes.map((commande) => commande.id),
        totalQuantity: pickupGroup.totalQuantity,
      })),
    })),
    [
      {
        dateKey: '2026-06-19',
        pickupPoints: [
          {
            pickupPoint: 'Marché de Gaillon',
            commandeIds: [1],
            totalQuantity: 2,
          },
        ],
      },
      {
        dateKey: '2026-06-20',
        pickupPoints: [
          {
            pickupPoint: 'Boutique',
            commandeIds: [2, 3],
            totalQuantity: 5,
          },
        ],
      },
    ],
  )
})
