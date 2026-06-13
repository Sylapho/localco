import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import {
  getProductionNeeds,
  getProductionNeedsByCommandeId,
} from './production-needs'
import type { Commande, CommandeStatut } from './api'

function makeCommande(data: {
  id: number
  statut?: CommandeStatut
  quantite: number
  stock: number
  dateRetrait?: string | null
  createdAt?: string
}): Commande {
  return {
    id: data.id,
    nom: `Client ${data.id}`,
    email: `client${data.id}@example.fr`,
    totalTtcCents: data.quantite * 200,
    lieu: 'Marche de Gaillon - Mardi matin, 8h-12h',
    dateRetrait: data.dateRetrait ?? null,
    statut: data.statut ?? 'nouvelle',
    createdAt: data.createdAt ?? `2026-06-10T08:${data.id}0:00.000Z`,
    lignes: [
      {
        id: data.id * 10,
        commandeId: data.id,
        articleId: 1,
        quantite: data.quantite,
        prixUnitCents: 200,
        article: {
          id: 1,
          nom: 'Baguette',
          prixCents: 200,
          tvaBps: 550,
          stock: data.stock,
          online: true,
          createdAt: '2026-06-10T08:00:00.000Z',
          updatedAt: '2026-06-10T08:00:00.000Z',
        },
      },
    ],
  }
}

function daysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(12, 0, 0, 0)

  return date.toISOString()
}

function dateKeyFromIso(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

test('getProductionNeeds groups fallback needs by due date and urgency', (t) => {
  mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-06-10T10:00:00.000Z'),
  })

  t.after(() => {
    mock.timers.reset()
  })

  const urgentDate = daysFromNow(1)
  const plannedDate = daysFromNow(4)
  const needs = getProductionNeeds([
    makeCommande({
      id: 1,
      quantite: 5,
      stock: -4,
      dateRetrait: urgentDate,
    }),
    makeCommande({
      id: 2,
      quantite: 2,
      stock: -4,
      dateRetrait: plannedDate,
    }),
  ])

  assert.deepEqual(
    needs.map((need) => ({
      dueDateKey: need.dueDateKey,
      quantityToProduce: need.quantityToProduce,
      commandeIds: need.commandeIds,
      urgency: need.urgency,
    })),
    [
      {
        dueDateKey: dateKeyFromIso(urgentDate),
        quantityToProduce: 2,
        commandeIds: [1],
        urgency: 'urgent',
      },
      {
        dueDateKey: dateKeyFromIso(plannedDate),
        quantityToProduce: 2,
        commandeIds: [2],
        urgency: 'planned',
      },
    ],
  )
})

test('getProductionNeeds distributes one date group without duplicating quantityToProduce', () => {
  const needs = getProductionNeeds([
    makeCommande({
      id: 1,
      quantite: 5,
      stock: -4,
      dateRetrait: '2026-06-12T00:00:00.000Z',
      createdAt: '2026-06-10T08:00:00.000Z',
    }),
    makeCommande({
      id: 2,
      quantite: 2,
      stock: -4,
      dateRetrait: '2026-06-12T00:00:00.000Z',
      createdAt: '2026-06-10T09:00:00.000Z',
    }),
  ])

  assert.equal(needs.length, 1)
  assert.equal(needs[0].quantityToProduce, 4)
  assert.deepEqual(needs[0].quantityByCommandeId, {
    1: 2,
    2: 2,
  })
  assert.equal(
    Object.values(needs[0].quantityByCommandeId).reduce(
      (total, quantity) => total + quantity,
      0,
    ),
    needs[0].quantityToProduce,
  )

  const needsByCommandeId = getProductionNeedsByCommandeId(needs)

  assert.equal(needsByCommandeId.get(1)?.[0].quantityToProduce, 2)
  assert.equal(needsByCommandeId.get(2)?.[0].quantityToProduce, 2)
})

test('getProductionNeeds removes fallback needs after replenishment', () => {
  const needs = getProductionNeeds([
    makeCommande({
      id: 1,
      quantite: 5,
      stock: 0,
      dateRetrait: '2026-06-12T00:00:00.000Z',
    }),
  ])

  assert.deepEqual(needs, [])
})

test('getProductionNeeds excludes final statuses from fallback needs', () => {
  const needs = getProductionNeeds([
    makeCommande({
      id: 1,
      statut: 'annulee',
      quantite: 5,
      stock: -10,
    }),
    makeCommande({
      id: 2,
      statut: 'traitee',
      quantite: 5,
      stock: -10,
    }),
  ])

  assert.deepEqual(needs, [])
})

test('getProductionNeeds accounts for pending reservations without showing them', () => {
  const needs = getProductionNeeds([
    makeCommande({
      id: 1,
      statut: 'paiement_en_attente',
      quantite: 3,
      stock: -4,
      dateRetrait: '2026-06-12T00:00:00.000Z',
    }),
    makeCommande({
      id: 2,
      statut: 'nouvelle',
      quantite: 4,
      stock: -4,
      dateRetrait: '2026-06-13T00:00:00.000Z',
    }),
  ])

  assert.equal(needs.length, 1)
  assert.equal(needs[0].quantityToProduce, 4)
  assert.deepEqual(needs[0].quantityByCommandeId, {
    2: 4,
  })
})

test('getProductionNeeds includes payment review orders', () => {
  const needs = getProductionNeeds([
    makeCommande({
      id: 1,
      statut: 'paiement_a_verifier',
      quantite: 5,
      stock: -2,
      dateRetrait: '2026-06-12T00:00:00.000Z',
    }),
  ])

  assert.equal(needs.length, 1)
  assert.equal(needs[0].quantityToProduce, 2)
  assert.deepEqual(needs[0].quantityByCommandeId, {
    1: 2,
  })
})
