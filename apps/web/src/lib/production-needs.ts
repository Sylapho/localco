import type { Commande, CommandeStatut } from './api'

export type ProductionUrgency = 'urgent' | 'soon' | 'planned' | 'unknown'

export type ProductionNeed = {
  articleId: number
  articleNom: string
  stock: number
  orderedQuantity: number
  quantityToProduce: number
  quantityByCommandeId: Record<number, number>
  dueDate?: string | null
  dueDateKey: string
  commandeIds: number[]
  urgency: ProductionUrgency
}

const productionStatuses = new Set<CommandeStatut>([
  'nouvelle',
  'preparee',
  'paiement_a_verifier',
])

export function getProductionNeeds(commandes: Commande[]): ProductionNeed[] {
  const todayKey = getLocalDateKey(new Date())
  const activeCommandes = commandes.filter((commande) =>
    productionStatuses.has(commande.statut),
  )
  const hasExplicitProductionData = activeCommandes.some((commande) =>
    commande.lignes.some((ligne) => ligne.productionQuantity !== undefined),
  )

  if (hasExplicitProductionData) {
    return getExplicitProductionNeeds(activeCommandes, todayKey)
  }

  const stockByArticle = new Map<number, number>()
  const articleNameById = new Map<number, string>()
  const demandByArticle = new Map<
    number,
    Map<
      string,
      {
        dueDate?: string | null
        quantity: number
        commandeIds: Set<number>
      }
    >
  >()

  for (const commande of activeCommandes) {
    for (const ligne of commande.lignes) {
      const articleId = ligne.articleId
      const stock = ligne.article.stock

      stockByArticle.set(articleId, stock)
      articleNameById.set(articleId, ligne.article.nom)

      const dueDateKey = getDueDateKey(commande.dateRetrait)
      const articleDemand =
        demandByArticle.get(articleId) ??
        new Map<
          string,
          {
            dueDate?: string | null
            quantity: number
            commandeIds: Set<number>
          }
        >()
      const dueDateDemand = articleDemand.get(dueDateKey) ?? {
        dueDate: commande.dateRetrait,
        quantity: 0,
        commandeIds: new Set<number>(),
      }

      dueDateDemand.quantity += ligne.quantite
      dueDateDemand.commandeIds.add(commande.id)
      articleDemand.set(dueDateKey, dueDateDemand)
      demandByArticle.set(articleId, articleDemand)
    }
  }

  const needs: ProductionNeed[] = []

  for (const [articleId, articleDemand] of demandByArticle.entries()) {
    const stock = stockByArticle.get(articleId) ?? 0

    if (stock >= 0) {
      continue
    }

    let remainingToProduce = Math.abs(stock)

    const dueDateDemands = Array.from(articleDemand.entries()).sort(
      ([dateA], [dateB]) => compareDueDateKeys(dateA, dateB),
    )

    for (const [dueDateKey, dueDateDemand] of dueDateDemands) {
      if (remainingToProduce <= 0) {
        break
      }

      const quantityToProduce = Math.min(
        remainingToProduce,
        dueDateDemand.quantity,
      )

      if (quantityToProduce <= 0) {
        continue
      }

      needs.push({
        articleId,
        articleNom: articleNameById.get(articleId) ?? `Article #${articleId}`,
        stock,
        orderedQuantity: dueDateDemand.quantity,
        quantityToProduce,
        quantityByCommandeId: Object.fromEntries(
          Array.from(dueDateDemand.commandeIds).map((commandeId) => [
            commandeId,
            quantityToProduce,
          ]),
        ),
        dueDate: dueDateDemand.dueDate,
        dueDateKey,
        commandeIds: Array.from(dueDateDemand.commandeIds).sort(
          (a, b) => a - b,
        ),
        urgency: getUrgency(dueDateKey, todayKey),
      })

      remainingToProduce -= quantityToProduce
    }
  }

  return needs.sort((a, b) => {
    const dateOrder = compareDueDateKeys(a.dueDateKey, b.dueDateKey)

    if (dateOrder !== 0) {
      return dateOrder
    }

    return a.articleNom.localeCompare(b.articleNom, 'fr')
  })
}

export function getProductionNeedsByCommandeId(needs: ProductionNeed[]) {
  const result = new Map<number, ProductionNeed[]>()

  for (const need of needs) {
    for (const commandeId of need.commandeIds) {
      const quantityToProduce = need.quantityByCommandeId[commandeId] ?? 0

      if (quantityToProduce <= 0) {
        continue
      }

      result.set(commandeId, [
        ...(result.get(commandeId) ?? []),
        {
          ...need,
          commandeIds: [commandeId],
          quantityToProduce,
        },
      ])
    }
  }

  return result
}

function getExplicitProductionNeeds(
  commandes: Commande[],
  todayKey: string,
): ProductionNeed[] {
  const needsByArticleAndDate = new Map<string, ProductionNeed>()

  for (const commande of commandes) {
    const dueDateKey = getDueDateKey(commande.dateRetrait)

    for (const ligne of commande.lignes) {
      const quantityToProduce = ligne.productionQuantity ?? 0

      if (quantityToProduce <= 0) {
        continue
      }

      const key = `${ligne.articleId}:${dueDateKey}`
      const need =
        needsByArticleAndDate.get(key) ??
        ({
          articleId: ligne.articleId,
          articleNom: ligne.article.nom,
          stock: ligne.article.stock,
          orderedQuantity: 0,
          quantityToProduce: 0,
          quantityByCommandeId: {},
          dueDate: commande.dateRetrait,
          dueDateKey,
          commandeIds: [],
          urgency: getUrgency(dueDateKey, todayKey),
        } satisfies ProductionNeed)

      need.stock = Math.min(need.stock, ligne.article.stock)
      need.orderedQuantity += ligne.quantite
      need.quantityToProduce += quantityToProduce
      need.quantityByCommandeId[commande.id] =
        (need.quantityByCommandeId[commande.id] ?? 0) + quantityToProduce

      if (!need.commandeIds.includes(commande.id)) {
        need.commandeIds.push(commande.id)
        need.commandeIds.sort((a, b) => a - b)
      }

      needsByArticleAndDate.set(key, need)
    }
  }

  return Array.from(needsByArticleAndDate.values()).sort((a, b) => {
    const dateOrder = compareDueDateKeys(a.dueDateKey, b.dueDateKey)

    if (dateOrder !== 0) {
      return dateOrder
    }

    return a.articleNom.localeCompare(b.articleNom, 'fr')
  })
}

function getDueDateKey(date?: string | null) {
  return date ? getLocalDateKey(new Date(date)) : 'unknown'
}

function compareDueDateKeys(dateA: string, dateB: string) {
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

function getUrgency(dueDateKey: string, todayKey: string): ProductionUrgency {
  if (dueDateKey === 'unknown') {
    return 'unknown'
  }

  const daysUntilDueDate = diffDays(todayKey, dueDateKey)

  if (daysUntilDueDate <= 1) {
    return 'urgent'
  }

  if (daysUntilDueDate <= 3) {
    return 'soon'
  }

  return 'planned'
}

function getLocalDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(date)
}

function diffDays(fromKey: string, toKey: string) {
  return (toUtcDate(toKey).getTime() - toUtcDate(fromKey).getTime()) / 86_400_000
}

function toUtcDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day))
}
