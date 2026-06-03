'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type {
  Article,
  MatierePremiere,
  MouvementStock,
  MouvementStockCible,
  MouvementStockType,
  StockLot,
} from '@/lib/api'
import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import ArticleImage from '@/components/articles/article-image'
import AdjustStockForm from './adjust-stock-form'
import ProduceLotForm from './produce-lot-form'
import ReceptionMatiereForm from './reception-matiere-form'

type StockDashboardProps = {
  articles: Article[]
  matieres: MatierePremiere[]
  mouvements: MouvementStock[]
  lots: StockLot[]
}

type StockTab = 'mp' | 'articles'
type StockFilter = 'all' | 'ok' | 'moyen' | 'critique'
type SortMode =
  | 'nom'
  | 'stock-asc'
  | 'stock-desc'
  | 'prix-asc'
  | 'prix-desc'
  | 'statut'

const API_URL = process.env.NEXT_PUBLIC_API_URL

const typeLabels: Record<MouvementStockType, string> = {
  vente: 'Vente',
  production: 'Production',
  reception: 'Réception',
  ajustement: 'Ajustement',
  perte: 'Perte',
  commande: 'Commande',
}

const cibleLabels: Record<MouvementStockCible, string> = {
  article: 'Article',
  matiere_premiere: 'Matière première',
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 3,
  }).format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

function mpStatus(matiere: MatierePremiere, stock = matiere.stock): StockFilter {
  if (stock <= matiere.seuil) {
    return 'critique'
  }

  if (stock <= matiere.seuil * 3) {
    return 'moyen'
  }

  return 'ok'
}

function articleStatus(article: Article, stock = article.stock): StockFilter {
  if (stock <= 0) {
    return 'critique'
  }

  if (stock <= 3) {
    return 'moyen'
  }

  return 'ok'
}

function statusLabel(status: StockFilter) {
  if (status === 'critique') return 'Critique'
  if (status === 'moyen') return 'Moyen'
  if (status === 'ok') return 'OK'
  return 'Tous'
}

function statusClass(status: StockFilter) {
  if (status === 'critique') {
    return 'bg-red-100 text-red-700'
  }

  if (status === 'moyen') {
    return 'bg-amber-100 text-amber-800'
  }

  return 'bg-green-100 text-green-700'
}

function statusRank(status: StockFilter) {
  if (status === 'critique') return 0
  if (status === 'moyen') return 1
  if (status === 'ok') return 2
  return 3
}

function movementName(mouvement: MouvementStock) {
  if (mouvement.cible === 'article') {
    return mouvement.article?.nom ?? `Article #${mouvement.articleId}`
  }

  return mouvement.mp?.nom ?? `Matière #${mouvement.mpId}`
}

function lotName(lot: StockLot) {
  if (lot.target === 'article') {
    return lot.article?.nom ?? `Article #${lot.articleId}`
  }

  return lot.mp?.nom ?? `Matière #${lot.mpId}`
}

function daysBeforeExpiry(value: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(value)
  expiry.setHours(0, 0, 0, 0)

  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000)
}

function lotStatus(lot: StockLot) {
  if (!lot.expiresAt) return 'Sans DLC'

  const days = daysBeforeExpiry(lot.expiresAt)

  if (days < 0) return 'Périmé'
  if (days <= 3) return 'Urgent'
  if (days <= 7) return 'À surveiller'

  return 'OK'
}

function lotStatusClass(status: string) {
  if (status === 'Périmé') return 'bg-red-100 text-red-800'
  if (status === 'Urgent') return 'bg-orange-100 text-orange-800'
  if (status === 'À surveiller') return 'bg-amber-100 text-amber-800'
  if (status === 'Sans DLC') return 'bg-gray-100 text-gray-700'

  return 'bg-green-100 text-green-700'
}

function expiredQuantityMap(lots: StockLot[], target: MouvementStockCible) {
  return lots.reduce((acc, lot) => {
    if (lot.target !== target || !lot.expiresAt || daysBeforeExpiry(lot.expiresAt) >= 0) {
      return acc
    }

    const id = target === 'article' ? lot.articleId : lot.mpId

    if (!id) return acc

    acc.set(id, (acc.get(id) ?? 0) + lot.remainingQuantity)
    return acc
  }, new Map<number, number>())
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${cell.replaceAll('"', '""')}"`)
        .join(','),
    )
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function StockDashboard({
  articles,
  matieres,
  mouvements,
  lots,
}: StockDashboardProps) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const [tab, setTab] = useState<StockTab>('mp')
  const [filter, setFilter] = useState<StockFilter>('all')
  const [sort, setSort] = useState<SortMode>('nom')
  const [lossLotId, setLossLotId] = useState<number | null>(null)
  const [lossError, setLossError] = useState('')

  const expiredQuantityByArticle = useMemo(
    () => expiredQuantityMap(lots, 'article'),
    [lots],
  )
  const expiredQuantityByMatiere = useMemo(
    () => expiredQuantityMap(lots, 'matiere_premiere'),
    [lots],
  )
  const sellableArticleStock = (article: Article) => {
    return Math.max(0, article.stock - (expiredQuantityByArticle.get(article.id) ?? 0))
  }
  const sellableMatiereStock = (matiere: MatierePremiere) => {
    return Math.max(0, matiere.stock - (expiredQuantityByMatiere.get(matiere.id) ?? 0))
  }
  const matieresCritiques = matieres.filter(
    (matiere) => mpStatus(matiere, sellableMatiereStock(matiere)) === 'critique',
  )
  const matieresMoyennes = matieres.filter(
    (matiere) => mpStatus(matiere, sellableMatiereStock(matiere)) === 'moyen',
  )
  const articlesCritiques = articles.filter(
    (article) => articleStatus(article, sellableArticleStock(article)) === 'critique',
  )
  const articlesMoyens = articles.filter(
    (article) => articleStatus(article, sellableArticleStock(article)) === 'moyen',
  )
  const expiringLots = lots
    .filter((lot) => lot.expiresAt)
    .filter((lot) => daysBeforeExpiry(lot.expiresAt!) <= 7)
    .sort((a, b) => {
      return new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime()
    })
  const expiredLots = expiringLots.filter((lot) => {
    return lot.expiresAt ? daysBeforeExpiry(lot.expiresAt) < 0 : false
  })
  const urgentLots = expiringLots.filter((lot) => {
    if (!lot.expiresAt) return false

    const days = daysBeforeExpiry(lot.expiresAt)

    return days >= 0 && days <= 3
  })

  const visibleMatieres = useMemo(() => {
    return matieres
      .filter((matiere) => {
        const sellableStock = Math.max(
          0,
          matiere.stock - (expiredQuantityByMatiere.get(matiere.id) ?? 0),
        )

        return filter === 'all' || mpStatus(matiere, sellableStock) === filter
      })
      .sort((a, b) => {
        if (sort === 'stock-asc') return a.stock - b.stock
        if (sort === 'stock-desc') return b.stock - a.stock
        if (sort === 'statut') {
          const aStock = Math.max(0, a.stock - (expiredQuantityByMatiere.get(a.id) ?? 0))
          const bStock = Math.max(0, b.stock - (expiredQuantityByMatiere.get(b.id) ?? 0))

          return statusRank(mpStatus(a, aStock)) - statusRank(mpStatus(b, bStock))
        }

        return a.nom.localeCompare(b.nom)
      })
  }, [expiredQuantityByMatiere, filter, matieres, sort])

  const visibleArticles = useMemo(() => {
    return articles
      .filter((article) => {
        const sellableStock = Math.max(
          0,
          article.stock - (expiredQuantityByArticle.get(article.id) ?? 0),
        )

        return filter === 'all' || articleStatus(article, sellableStock) === filter
      })
      .sort((a, b) => {
        if (sort === 'stock-asc') return a.stock - b.stock
        if (sort === 'stock-desc') return b.stock - a.stock
        if (sort === 'prix-asc') return a.prix - b.prix
        if (sort === 'prix-desc') return b.prix - a.prix
        if (sort === 'statut') {
          const aStock = Math.max(0, a.stock - (expiredQuantityByArticle.get(a.id) ?? 0))
          const bStock = Math.max(0, b.stock - (expiredQuantityByArticle.get(b.id) ?? 0))

          return (
            statusRank(articleStatus(a, aStock)) -
            statusRank(articleStatus(b, bStock))
          )
        }

        return a.nom.localeCompare(b.nom)
      })
  }, [articles, expiredQuantityByArticle, filter, sort])

  async function markLotAsLoss(lot: StockLot) {
    const confirmed = window.confirm('Passer ce lot périmé en perte ?')

    if (!confirmed) return

    setLossLotId(lot.id)
    setLossError('')

    try {
      const response = await authenticatedFetch(
        `${API_URL}/mouvements-stock/lots/${lot.id}/perte`,
        {
          method: 'POST',
        },
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Impossible de passer ce lot en perte')
      }

      router.refresh()
    } catch (err) {
      setLossError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLossLotId(null)
    }
  }

  function exportCurrentTab() {
    if (tab === 'mp') {
      downloadCsv('stock-matieres-premieres.csv', [
        [
          'Matière',
          'Stock total',
          'Stock vendable',
          'Unité',
          'Seuil',
          'Conditionnement',
          'Statut',
        ],
        ...visibleMatieres.map((matiere) => [
          matiere.nom,
          String(matiere.stock),
          String(sellableMatiereStock(matiere)),
          matiere.unite,
          String(matiere.seuil),
          matiere.conditionnement,
          statusLabel(mpStatus(matiere, sellableMatiereStock(matiere))),
        ]),
      ])
      return
    }

    downloadCsv('stock-articles.csv', [
      ['Article', 'Stock total', 'Stock vendable', 'Prix TTC', 'En ligne', 'Statut'],
      ...visibleArticles.map((article) => [
        article.nom,
        String(article.stock),
        String(sellableArticleStock(article)),
        String(article.prix),
        article.online ? 'Oui' : 'Non',
        statusLabel(articleStatus(article, sellableArticleStock(article))),
      ]),
    ])
  }

  return (
    <main className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Stock</h1>
          <p className="mt-1 text-sm text-gray-600">
            Matières premières, articles finis, DLC, alertes et actions rapides.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/matieres-premieres/new" className="rounded border px-4 py-2 text-sm">
            + Matière première
          </Link>
          <a href="#lot-article" className="rounded border px-4 py-2 text-sm">
            + Lot article
          </a>
          <a href="#reappro" className="rounded bg-black px-4 py-2 text-sm text-white">
            + Réappro
          </a>
        </div>
      </div>

      <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            MP critiques
          </p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {matieresCritiques.length}
          </p>
        </div>
        <div className="rounded border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            MP à surveiller
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {matieresMoyennes.length}
          </p>
        </div>
        <div className="rounded border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Articles en rupture
          </p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {articlesCritiques.length}
          </p>
        </div>
        <div className="rounded border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Articles bas
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-700">
            {articlesMoyens.length}
          </p>
        </div>
      </section>

      <section className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="rounded border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Lots avec DLC
          </p>
          <p className="mt-2 text-2xl font-bold">{lots.length}</p>
        </div>
        <div className="rounded border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            DLC ≤ 3 jours
          </p>
          <p className="mt-2 text-2xl font-bold text-orange-700">
            {urgentLots.length}
          </p>
        </div>
        <div className="rounded border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Périmés
          </p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {expiredLots.length}
          </p>
        </div>
      </section>

      {(matieresCritiques.length > 0 || articlesCritiques.length > 0) ? (
        <section className="mb-6 rounded border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-800">Alertes stock</h2>
          <div className="mt-2 grid gap-1 text-sm text-red-800">
            {matieresCritiques.slice(0, 4).map((matiere) => (
              <p key={`mp-${matiere.id}`}>
                {matiere.nom} : {formatNumber(matiere.stock)} {matiere.unite} restant(s)
              </p>
            ))}
            {articlesCritiques.slice(0, 4).map((article) => (
              <p key={`article-${article.id}`}>
                {article.nom} : {article.stock} en stock
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-6 rounded border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Lots DLC à surveiller</h2>
        {expiringLots.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">
            Aucun lot avec une DLC proche.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-gray-600">
                  <th className="py-3 pr-4 font-medium">Élément</th>
                  <th className="py-3 pr-4 font-medium">Type</th>
                  <th className="py-3 pr-4 font-medium">Quantité restante</th>
                  <th className="py-3 pr-4 font-medium">DLC</th>
                  <th className="py-3 pr-4 font-medium">Statut</th>
                  <th className="py-3 pr-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {expiringLots.slice(0, 8).map((lot) => {
                  const status = lotStatus(lot)

                  return (
                    <tr key={lot.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-4 font-medium">{lotName(lot)}</td>
                      <td className="py-3 pr-4">{cibleLabels[lot.target]}</td>
                      <td className="py-3 pr-4">
                        {formatNumber(lot.remainingQuantity)}
                      </td>
                      <td className="py-3 pr-4">
                        {lot.expiresAt ? formatDate(lot.expiresAt) : 'Non renseignée'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${lotStatusClass(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {status === 'Périmé' ? (
                          <button
                            type="button"
                            onClick={() => markLotAsLoss(lot)}
                            disabled={lossLotId === lot.id}
                            className="rounded bg-red-600 px-3 py-2 text-xs text-white disabled:opacity-50"
                          >
                            {lossLotId === lot.id
                              ? 'Traitement...'
                              : 'Passer en perte'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {lossError ? <p className="mt-3 text-sm text-red-600">{lossError}</p> : null}
      </section>

      <section className="rounded border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTab('mp')
                setFilter('all')
                setSort('nom')
              }}
              className={
                tab === 'mp'
                  ? 'rounded bg-black px-3 py-2 text-sm text-white'
                  : 'rounded border px-3 py-2 text-sm'
              }
            >
              Matières premières
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('articles')
                setFilter('all')
                setSort('nom')
              }}
              className={
                tab === 'articles'
                  ? 'rounded bg-black px-3 py-2 text-sm text-white'
                  : 'rounded border px-3 py-2 text-sm'
              }
            >
              Articles finis
            </button>
          </div>

          <button
            type="button"
            onClick={exportCurrentTab}
            className="rounded border px-3 py-2 text-sm"
          >
            Export CSV
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as StockFilter)}
            className="rounded border px-3 py-2 text-sm"
            title="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            <option value="ok">OK</option>
            <option value="moyen">Moyen</option>
            <option value="critique">Critique</option>
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            className="rounded border px-3 py-2 text-sm"
            title="Trier"
          >
            <option value="nom">Trier : Nom</option>
            <option value="stock-asc">Stock croissant</option>
            <option value="stock-desc">Stock décroissant</option>
            {tab === 'articles' ? (
              <>
                <option value="prix-asc">Prix croissant</option>
                <option value="prix-desc">Prix décroissant</option>
              </>
            ) : null}
            <option value="statut">Statut critique en premier</option>
          </select>
        </div>

        {tab === 'mp' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-gray-600">
                  <th className="py-3 pr-4 font-medium">Matière</th>
                  <th className="py-3 pr-4 font-medium">Stock total</th>
                  <th className="py-3 pr-4 font-medium">Vendable</th>
                  <th className="py-3 pr-4 font-medium">Seuil</th>
                  <th className="py-3 pr-4 font-medium">Conditionnement</th>
                  <th className="py-3 pr-4 font-medium">Statut</th>
                  <th className="py-3 pr-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleMatieres.map((matiere) => {
                  const sellableStock = sellableMatiereStock(matiere)
                  const status = mpStatus(matiere, sellableStock)

                  return (
                    <tr key={matiere.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-4 font-medium">{matiere.nom}</td>
                      <td className="py-3 pr-4">
                        {formatNumber(matiere.stock)} {matiere.unite}
                      </td>
                      <td className="py-3 pr-4">
                        {formatNumber(sellableStock)} {matiere.unite}
                      </td>
                      <td className="py-3 pr-4">
                        {formatNumber(matiere.seuil)} {matiere.unite}
                      </td>
                      <td className="py-3 pr-4">{matiere.conditionnement}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(status)}`}>
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/matieres-premieres/${matiere.id}`}
                          className="rounded border px-3 py-2 text-xs"
                        >
                          Voir
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-gray-600">
                  <th className="py-3 pr-4 font-medium">Article</th>
                  <th className="py-3 pr-4 font-medium">Stock total</th>
                  <th className="py-3 pr-4 font-medium">Vendable</th>
                  <th className="py-3 pr-4 font-medium">Prix TTC</th>
                  <th className="py-3 pr-4 font-medium">En ligne</th>
                  <th className="py-3 pr-4 font-medium">Statut</th>
                  <th className="py-3 pr-4 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleArticles.map((article) => {
                  const sellableStock = sellableArticleStock(article)
                  const status = articleStatus(article, sellableStock)

                  return (
                    <tr key={article.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <ArticleImage
                            article={article}
                            className="h-8 w-8 overflow-hidden rounded border bg-gray-100"
                          />
                          <span className="font-medium">{article.nom}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">{article.stock}</td>
                      <td className="py-3 pr-4">{formatNumber(sellableStock)}</td>
                      <td className="py-3 pr-4">{formatCurrency(article.prix)}</td>
                      <td className="py-3 pr-4">{article.online ? 'Oui' : 'Non'}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(status)}`}>
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <Link
                          href={`/articles/${article.id}`}
                          className="rounded border px-3 py-2 text-xs"
                        >
                          Voir
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <div id="reappro">
          <ReceptionMatiereForm
            matieres={matieres.map((matiere) => ({
              id: matiere.id,
              nom: matiere.nom,
              unite: matiere.unite,
            }))}
          />
        </div>

        <ProduceLotForm
          articles={articles.map((article) => ({
            id: article.id,
            nom: article.nom,
          }))}
        />

        <AdjustStockForm
          articles={articles.map((article) => ({
            id: article.id,
            nom: article.nom,
            stock: article.stock,
          }))}
          matieres={matieres.map((matiere) => ({
            id: matiere.id,
            nom: matiere.nom,
            stock: matiere.stock,
            unite: matiere.unite,
          }))}
        />
      </section>

      <section className="mt-6 rounded border bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Derniers mouvements</h2>
        {mouvements.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">
            Aucun mouvement enregistré pour le moment.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {mouvements.slice(0, 8).map((mouvement) => {
              const quantityPrefix = mouvement.quantite > 0 ? '+' : ''

              return (
                <div
                  key={mouvement.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium">{movementName(mouvement)}</p>
                    <p className="text-sm text-gray-600">
                      {typeLabels[mouvement.type]} - {cibleLabels[mouvement.cible]} -{' '}
                      {formatDateTime(mouvement.createdAt)}
                    </p>
                  </div>
                  <p
                    className={
                      mouvement.quantite >= 0
                        ? 'font-semibold text-green-700'
                        : 'font-semibold text-red-700'
                    }
                  >
                    {quantityPrefix}
                    {formatNumber(mouvement.quantite)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
