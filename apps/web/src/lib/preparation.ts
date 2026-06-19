import type { Commande, CommandeStatut } from './api'

export const preparationStatuses = new Set<CommandeStatut>([
  'nouvelle',
  'preparee',
])

export type PreparationDateSelection = {
  value: string
  label: string
  dateKey?: string
}

export type PreparationDateOptions = Record<
  'today' | 'tomorrow' | 'all',
  PreparationDateSelection
>

export type PreparationFilters = {
  dateKey?: string
  pickupPoint?: string
}

export type PreparationLine = {
  articleId: number
  articleNom: string
  quantity: number
  commandeIds: number[]
}

export type PreparationPickupGroup = {
  pickupPoint: string
  commandes: Commande[]
  lines: PreparationLine[]
  totalQuantity: number
}

export type PreparationDateGroup = {
  dateKey: string
  dateRetrait?: string | null
  pickupGroups: PreparationPickupGroup[]
  commandes: Commande[]
  lines: PreparationLine[]
  totalQuantity: number
}

export function getLocalDateKey(value?: string | Date | null) {
  if (!value) {
    return 'unknown'
  }

  const date = typeof value === 'string' ? new Date(value) : value

  if (Number.isNaN(date.getTime())) {
    return 'unknown'
  }

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(date)
}

export function getPreparationDateOptions(now = new Date()): PreparationDateOptions {
  const todayKey = getLocalDateKey(now)
  const tomorrowKey = addDaysToDateKey(todayKey, 1)

  return {
    today: {
      value: 'today',
      label: "Aujourd'hui",
      dateKey: todayKey,
    },
    tomorrow: {
      value: 'tomorrow',
      label: 'Demain',
      dateKey: tomorrowKey,
    },
    all: {
      value: 'all',
      label: 'Toutes les dates',
    },
  }
}

export function resolvePreparationDateSelection(
  value?: string,
  now = new Date(),
): PreparationDateSelection {
  const options = getPreparationDateOptions(now)
  const selectedValue = value?.trim() || 'today'

  if (selectedValue === 'tomorrow') {
    return options.tomorrow
  }

  if (selectedValue === 'all') {
    return options.all
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(selectedValue)) {
    return {
      value: selectedValue,
      label: selectedValue,
      dateKey: selectedValue,
    }
  }

  return options.today
}

export function getPreparationCommandes(
  commandes: Commande[],
  filters: PreparationFilters = {},
) {
  const pickupPoint = filters.pickupPoint?.trim()

  return commandes
    .filter((commande) => preparationStatuses.has(commande.statut))
    .filter((commande) => {
      if (filters.dateKey && getLocalDateKey(commande.dateRetrait) !== filters.dateKey) {
        return false
      }

      if (pickupPoint && commande.lieu !== pickupPoint) {
        return false
      }

      return true
    })
    .sort(compareCommandes)
}

export function getPreparationPickupPoints(commandes: Commande[]) {
  return Array.from(
    new Set(
      commandes
        .filter((commande) => preparationStatuses.has(commande.statut))
        .map((commande) => commande.lieu),
    ),
  ).sort((a, b) => a.localeCompare(b, 'fr'))
}

export function aggregatePreparationLines(
  commandes: Commande[],
): PreparationLine[] {
  const linesByArticle = new Map<number, PreparationLine>()

  for (const commande of commandes) {
    for (const ligne of commande.lignes) {
      const line =
        linesByArticle.get(ligne.articleId) ??
        ({
          articleId: ligne.articleId,
          articleNom: ligne.article.nom,
          quantity: 0,
          commandeIds: [],
        } satisfies PreparationLine)

      line.quantity += ligne.quantite

      if (!line.commandeIds.includes(commande.id)) {
        line.commandeIds.push(commande.id)
        line.commandeIds.sort((a, b) => a - b)
      }

      linesByArticle.set(ligne.articleId, line)
    }
  }

  return Array.from(linesByArticle.values()).sort((a, b) =>
    a.articleNom.localeCompare(b.articleNom, 'fr'),
  )
}

export function groupPreparationCommandes(
  commandes: Commande[],
): PreparationDateGroup[] {
  const groupsByDate = new Map<
    string,
    {
      dateKey: string
      dateRetrait?: string | null
      commandes: Commande[]
    }
  >()

  for (const commande of [...commandes].sort(compareCommandes)) {
    const dateKey = getLocalDateKey(commande.dateRetrait)
    const group = groupsByDate.get(dateKey) ?? {
      dateKey,
      dateRetrait: commande.dateRetrait,
      commandes: [],
    }

    group.commandes.push(commande)
    groupsByDate.set(dateKey, group)
  }

  return Array.from(groupsByDate.values())
    .sort((a, b) => compareDateKeys(a.dateKey, b.dateKey))
    .map((group) => {
      const pickupGroups = groupByPickupPoint(group.commandes)
      const lines = aggregatePreparationLines(group.commandes)

      return {
        dateKey: group.dateKey,
        dateRetrait: group.dateRetrait,
        pickupGroups,
        commandes: group.commandes,
        lines,
        totalQuantity: getTotalQuantity(lines),
      }
    })
}

function groupByPickupPoint(commandes: Commande[]): PreparationPickupGroup[] {
  const groupsByPickupPoint = new Map<string, Commande[]>()

  for (const commande of commandes) {
    groupsByPickupPoint.set(commande.lieu, [
      ...(groupsByPickupPoint.get(commande.lieu) ?? []),
      commande,
    ])
  }

  return Array.from(groupsByPickupPoint.entries())
    .sort(([pickupPointA], [pickupPointB]) =>
      pickupPointA.localeCompare(pickupPointB, 'fr'),
    )
    .map(([pickupPoint, pickupCommandes]) => {
      const lines = aggregatePreparationLines(pickupCommandes)

      return {
        pickupPoint,
        commandes: pickupCommandes,
        lines,
        totalQuantity: getTotalQuantity(lines),
      }
    })
}

function compareCommandes(a: Commande, b: Commande) {
  const dateOrder = compareDateKeys(
    getLocalDateKey(a.dateRetrait),
    getLocalDateKey(b.dateRetrait),
  )

  if (dateOrder !== 0) {
    return dateOrder
  }

  const pickupOrder = a.lieu.localeCompare(b.lieu, 'fr')

  if (pickupOrder !== 0) {
    return pickupOrder
  }

  return a.id - b.id
}

function compareDateKeys(dateA: string, dateB: string) {
  if (dateA === 'unknown' && dateB === 'unknown') {
    return 0
  }

  if (dateA === 'unknown') {
    return 1
  }

  if (dateB === 'unknown') {
    return -1
  }

  return dateA.localeCompare(dateB)
}

function getTotalQuantity(lines: PreparationLine[]) {
  return lines.reduce((total, line) => total + line.quantity, 0)
}

function addDaysToDateKey(dateKey: string, days: number) {
  if (dateKey === 'unknown') {
    return dateKey
  }

  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))

  return getLocalDateKey(date)
}
