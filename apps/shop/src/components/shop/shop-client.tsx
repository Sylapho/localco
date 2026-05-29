'use client'

import type { CreateCommandePayload, ShopArticle } from '@/lib/api'
import ArticleImage from './article-image'
import { FormEvent, useMemo, useState } from 'react'

type ShopClientProps = {
  articles: ShopArticle[]
  apiUrl: string
}

type Cart = Record<number, number>

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

export default function ShopClient({
  articles,
  apiUrl,
}: ShopClientProps) {
  const [cart, setCart] = useState<Cart>({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [lieu, setLieu] = useState('En boutique')
  const [dateRetrait, setDateRetrait] = useState(todayInputValue())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const articlesById = useMemo(
    () => new Map(articles.map((article) => [article.id, article])),
    [articles],
  )

  const lines = Object.entries(cart)
    .map(([articleId, quantite]) => {
      const article = articlesById.get(Number(articleId))

      if (!article) return null

      return {
        article,
        quantite,
        total: article.prix * quantite,
      }
    })
    .filter((line): line is NonNullable<typeof line> => Boolean(line))

  const total = lines.reduce((sum, line) => sum + line.total, 0)
  const count = lines.reduce((sum, line) => sum + line.quantite, 0)

  function updateCart(article: ShopArticle, delta: number) {
    setCart((current) => {
      const nextQuantity = Math.max(
        0,
        Math.min(article.stock, (current[article.id] ?? 0) + delta),
      )
      const next = { ...current }

      if (nextQuantity === 0) {
        delete next[article.id]
      } else {
        next[article.id] = nextQuantity
      }

      return next
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    if (lines.length === 0) {
      setError('Votre panier est vide.')
      setLoading(false)
      return
    }

    try {
      const payload: CreateCommandePayload = {
        nom,
        email,
        tel: tel || undefined,
        lieu,
        dateRetrait,
        lignes: lines.map((line) => ({
          articleId: line.article.id,
          quantite: line.quantite,
        })),
      }

      const response = await fetch(`${apiUrl}/commandes/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Impossible de preparer le paiement')
      }

      const checkout = (await response.json()) as {
        url: string
      }

      window.location.assign(checkout.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <Header count={count} onCartClick={() => setPanelOpen(true)} />

      <section className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 rounded-lg bg-[#fceef6] p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#b5006e]">
            Commande en ligne
          </p>
          <h1 className="mt-1 text-3xl font-bold">Les Cocottes de Diane</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Choisissez vos produits, puis indiquez votre lieu et date de
            retrait. Le paiement securise se fait en ligne.
          </p>
        </div>

        {articles.length === 0 ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-zinc-600">
            Aucun article disponible pour le moment.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => {
              const quantity = cart[article.id] ?? 0
              const disabled = article.stock <= 0

              return (
                <article
                  key={article.id}
                  className="overflow-hidden rounded-lg border bg-white shadow-sm"
                >
                  <ArticleImage article={article} />
                  <div className="grid gap-3 p-4">
                    <div>
                      <h2 className="font-semibold">{article.nom}</h2>
                      {article.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-zinc-600">
                          {article.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-[#b5006e]">
                          {formatCurrency(article.prix)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {article.stock > 0
                            ? `${article.stock} disponible(s)`
                            : 'Epuise'}
                        </p>
                      </div>

                      {quantity === 0 ? (
                        <button
                          type="button"
                          onClick={() => updateCart(article, 1)}
                          disabled={disabled}
                          className="rounded bg-[#b5006e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          Ajouter
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateCart(article, -1)}
                            className="grid h-8 w-8 place-items-center rounded-full border"
                          >
                            -
                          </button>
                          <span className="min-w-4 text-center font-semibold">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCart(article, 1)}
                            disabled={quantity >= article.stock}
                            className="grid h-8 w-8 place-items-center rounded-full border disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {panelOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Fermer le panier"
            className="absolute inset-0 bg-black/40"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-semibold">Mon panier</h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded border px-3 py-1"
              >
                Fermer
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {lines.length === 0 ? (
                <p className="text-sm text-zinc-600">Votre panier est vide.</p>
              ) : (
                <ul className="grid gap-3">
                  {lines.map((line) => (
                    <li
                      key={line.article.id}
                      className="flex items-center justify-between gap-3 border-b pb-3"
                    >
                      <div>
                        <p className="font-medium">{line.article.nom}</p>
                        <p className="text-sm text-zinc-600">
                          {line.quantite} x {formatCurrency(line.article.prix)}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatCurrency(line.total)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form onSubmit={handleSubmit} className="grid gap-3 border-t p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Total TTC</span>
                <strong className="text-xl">{formatCurrency(total)}</strong>
              </div>

              <div className="grid gap-1">
                <label htmlFor="nom">Nom / Prenom *</label>
                <input
                  id="nom"
                  value={nom}
                  onChange={(event) => setNom(event.target.value)}
                  className="rounded border px-3 py-2"
                  required
                />
              </div>

              <div className="grid gap-1">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="rounded border px-3 py-2"
                  required
                />
              </div>

              <div className="grid gap-1">
                <label htmlFor="tel">Telephone</label>
                <input
                  id="tel"
                  type="tel"
                  value={tel}
                  onChange={(event) => setTel(event.target.value)}
                  className="rounded border px-3 py-2"
                />
              </div>

              <div className="grid gap-1">
                <label htmlFor="lieu">Lieu de retrait *</label>
                <select
                  id="lieu"
                  value={lieu}
                  onChange={(event) => setLieu(event.target.value)}
                  className="rounded border px-3 py-2"
                >
                  <option value="En boutique">En boutique</option>
                  <option value="Marche du samedi matin">
                    Marche du samedi matin
                  </option>
                  <option value="Marche du dimanche">Marche du dimanche</option>
                </select>
              </div>

              <div className="grid gap-1">
                <label htmlFor="dateRetrait">Date souhaitee *</label>
                <input
                  id="dateRetrait"
                  type="date"
                  min={todayInputValue()}
                  value={dateRetrait}
                  onChange={(event) => setDateRetrait(event.target.value)}
                  className="rounded border px-3 py-2"
                  required
                />
              </div>

              <p className="rounded bg-[#fceef6] p-3 text-xs text-[#8c0055]">
                Vos informations sont utilisees uniquement pour traiter cette
                commande.
              </p>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={loading || lines.length === 0}
                className="rounded bg-[#b5006e] px-4 py-3 font-semibold text-white disabled:opacity-40"
              >
                {loading ? 'Preparation du paiement...' : 'Payer ma commande'}
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </main>
  )
}

function Header({
  count,
  onCartClick,
}: {
  count: number
  onCartClick: () => void
}) {
  return (
    <header className="sticky top-0 z-30 bg-[#b5006e] text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="font-bold">
            Les Cocottes de <span className="text-[#fde68a]">Diane</span>
          </p>
          <p className="text-xs text-white/70">Commande en ligne</p>
        </div>
        <button
          type="button"
          onClick={onCartClick}
          className="rounded border border-white/30 bg-white/15 px-3 py-2 text-sm font-semibold"
        >
          Panier ({count})
        </button>
      </div>
    </header>
  )
}
