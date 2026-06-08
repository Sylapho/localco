'use client'

import type { Article, VenteMode } from '@/lib/api'
import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import { calculateHtFromTtcCents, eurosToCents } from '@/lib/money'
import { useSessionFetch } from '@/lib/use-session-fetch'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'

type SaleLineForm = {
  articleId: string
  quantite: string
}

type NewVenteFormProps = {
  articles: Article[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

const modeLabels: Record<VenteMode, string> = {
  cb: 'Carte bancaire',
  especes: 'Espèces',
  cheque: 'Chèque',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100)
}

function createEmptyLine(): SaleLineForm {
  return {
    articleId: '',
    quantite: '1',
  }
}

export default function NewVenteForm({ articles }: NewVenteFormProps) {
  const router = useRouter()
  const sessionFetch = useSessionFetch()

  const [mode, setMode] = useState<VenteMode>('cb')
  const [remise, setRemise] = useState('0')
  const [lignes, setLignes] = useState<SaleLineForm[]>([createEmptyLine()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const articleById = useMemo(() => {
    return new Map(articles.map((article) => [article.id, article]))
  }, [articles])

  const totals = useMemo(() => {
    const totalAvantRemiseTTC = lignes.reduce((total, ligne) => {
      const article = articleById.get(Number(ligne.articleId))
      const quantite = Number(ligne.quantite)

      if (!article || !Number.isFinite(quantite) || quantite <= 0) {
        return total
      }

      return total + article.prixCents * quantite
    }, 0)

    const remiseCents = eurosToCents(Math.max(0, Number(remise) || 0))
    const totalTTC = Math.max(0, totalAvantRemiseTTC - remiseCents)
    const ratio =
      totalAvantRemiseTTC > 0 ? totalTTC / totalAvantRemiseTTC : 1

    const totalAvantRemiseHT = lignes.reduce((total, ligne) => {
      const article = articleById.get(Number(ligne.articleId))
      const quantite = Number(ligne.quantite)

      if (!article || !Number.isFinite(quantite) || quantite <= 0) {
        return total
      }

      return (
        total +
        calculateHtFromTtcCents(article.prixCents * quantite, article.tvaBps)
      )
    }, 0)

    const totalHT = Math.round(totalAvantRemiseHT * ratio)

    return {
      remiseCents,
      totalAvantRemiseTTC,
      totalHT,
      totalTTC,
      tva: totalTTC - totalHT,
    }
  }, [articleById, lignes, remise])

  function updateLine(index: number, line: Partial<SaleLineForm>) {
    setLignes((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...line } : item,
      ),
    )
  }

  function removeLine(index: number) {
    setLignes((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const normalizedLines = lignes
      .map((ligne) => ({
        articleId: Number(ligne.articleId),
        quantite: Number(ligne.quantite),
      }))
      .filter((ligne) => ligne.articleId > 0 && ligne.quantite > 0)

    const requestedByArticle = normalizedLines.reduce((acc, ligne) => {
      acc.set(ligne.articleId, (acc.get(ligne.articleId) ?? 0) + ligne.quantite)
      return acc
    }, new Map<number, number>())

    const stockError = Array.from(requestedByArticle.entries()).find(
      ([articleId, quantite]) => {
        const article = articleById.get(articleId)
        return article ? quantite > article.stock : false
      },
    )

    if (normalizedLines.length === 0) {
      setError('Ajoutez au moins une ligne de vente.')
      setLoading(false)
      return
    }

    if (stockError) {
      const [articleId, quantite] = stockError
      const article = articleById.get(articleId)
      setError(
        `Stock insuffisant pour ${article?.nom ?? 'cet article'} (${quantite} demandé, ${article?.stock ?? 0} disponible).`,
      )
      setLoading(false)
      return
    }

    try {
      const response = await sessionFetch(`${API_URL}/ventes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          remiseCents: totals.remiseCents,
          lignes: normalizedLines,
        }),
      })

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            'Erreur lors de la création de la vente.',
          ),
        )
      }

      router.push('/ventes')
      router.refresh()
    } catch (err) {
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="grid gap-4">
        <div className="rounded border p-4">
          <label htmlFor="mode" className="mb-2 block font-medium">
            Mode de paiement
          </label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as VenteMode)}
            className="w-full rounded border px-3 py-2"
          >
            {Object.entries(modeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Articles vendus</h2>
            <button
              type="button"
              onClick={() => setLignes((current) => [...current, createEmptyLine()])}
              className="rounded border px-3 py-2 text-sm"
            >
              Ajouter une ligne
            </button>
          </div>

          {lignes.map((ligne, index) => {
            const selectedArticle = articleById.get(Number(ligne.articleId))
            const quantite = Number(ligne.quantite) || 0
            const lineTotal = selectedArticle
              ? selectedArticle.prixCents * quantite
              : 0
            const isOverStock = selectedArticle
              ? quantite > selectedArticle.stock
              : false

            return (
              <div key={index} className="rounded border p-4">
                <div className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
                  <div className="grid gap-1">
                    <label htmlFor={`article-${index}`}>Article</label>
                    <select
                      id={`article-${index}`}
                      value={ligne.articleId}
                      onChange={(e) =>
                        updateLine(index, { articleId: e.target.value })
                      }
                      className="rounded border px-3 py-2"
                      required
                    >
                      <option value="">Choisir un article</option>
                      {articles.map((article) => (
                        <option key={article.id} value={article.id}>
                          {article.nom} - {formatCurrency(article.prixCents)} -
                          stock {article.stock}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-1">
                    <label htmlFor={`quantite-${index}`}>Quantité</label>
                    <input
                      id={`quantite-${index}`}
                      type="number"
                      min="1"
                      max={selectedArticle?.stock}
                      value={ligne.quantite}
                      onChange={(e) =>
                        updateLine(index, { quantite: e.target.value })
                      }
                      className="rounded border px-3 py-2"
                      required
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lignes.length === 1}
                    className="self-end rounded border px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Retirer
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
                  <span>Ligne : {formatCurrency(lineTotal)}</span>
                  {selectedArticle ? (
                    <span>Stock disponible : {selectedArticle.stock}</span>
                  ) : null}
                  {isOverStock ? (
                    <span className="text-red-600">Stock insuffisant</span>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <aside className="h-fit rounded border p-4">
        <h2 className="mb-4 text-lg font-semibold">Résumé</h2>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <label htmlFor="remise">Remise</label>
            <input
              id="remise"
              type="number"
              min="0"
              step="0.01"
              value={remise}
              onChange={(e) => setRemise(e.target.value)}
              className="rounded border px-3 py-2"
            />
          </div>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Total avant remise</dt>
              <dd>{formatCurrency(totals.totalAvantRemiseTTC)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Total HT</dt>
              <dd>{formatCurrency(totals.totalHT)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>TVA</dt>
              <dd>{formatCurrency(totals.tva)}</dd>
            </div>
            <div className="flex justify-between gap-4 text-base font-semibold">
              <dt>Total TTC</dt>
              <dd>{formatCurrency(totals.totalTTC)}</dd>
            </div>
          </dl>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading || articles.length === 0}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer la vente'}
          </button>
        </div>
      </aside>
    </form>
  )
}
