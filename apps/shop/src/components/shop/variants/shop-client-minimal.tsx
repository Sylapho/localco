'use client'

import type { CreateCommandePayload, ShopArticle } from '@/lib/api'
import { formatPickupPoint, pickupPoints } from '@/lib/pickup-points'
import ArticleImage from '../article-image'
import Image from 'next/image'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'

type ShopClientProps = {
  articles: ShopArticle[]
  apiUrl: string
}

type Cart = Record<number, number>

type SortMode = 'recommended' | 'price-asc' | 'price-desc'

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function todayInputValue() {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
}

export default function ShopClientMinimal({
  articles,
  apiUrl,
}: ShopClientProps) {
  const [cart, setCart] = useState<Cart>({})
  const [panelOpen, setPanelOpen] = useState(false)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [lieu, setLieu] = useState(formatPickupPoint(pickupPoints[0]))
  const [dateRetrait, setDateRetrait] = useState(todayInputValue())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('recommended')
  const [onlyAvailable, setOnlyAvailable] = useState(false)

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

  const filteredArticles = useMemo(() => {
    const query = normalizeSearch(search)

    const filtered = articles.filter((article) => {
      const searchable = normalizeSearch(
        `${article.nom} ${article.description ?? ''}`,
      )

      const matchesSearch = query.length === 0 || searchable.includes(query)
      const matchesAvailability = !onlyAvailable || article.stock > 0

      return matchesSearch && matchesAvailability
    })

    return filtered.sort((a, b) => {
      if (sortMode === 'price-asc') return a.prix - b.prix
      if (sortMode === 'price-desc') return b.prix - a.prix

      return Number(b.stock > 0) - Number(a.stock > 0)
    })
  }, [articles, onlyAvailable, search, sortMode])

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

  function removeFromCart(articleId: number) {
    setCart((current) => {
      const next = { ...current }
      delete next[articleId]
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
        throw new Error(text || 'Impossible de préparer la commande')
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
    <main className="min-h-screen bg-white pb-28 text-stone-950 sm:pb-0">
      <Header
        count={count}
        total={total}
        onCartClick={() => setPanelOpen(true)}
      />

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <Image
              src="/logo.svg"
              alt="Les Cocottes de Diane"
              width={72}
              height={72}
              priority
              className="h-16 w-16 shrink-0 rounded-full border border-stone-200 bg-white object-contain p-1.5"
            />

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Boutique en ligne
              </p>
              <h1 className="font-display mt-2 text-4xl font-semibold leading-none text-stone-950 sm:text-5xl">
                Les Cocottes de Diane
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600">
                Commandez vos produits, choisissez un lieu de retrait, puis
                validez votre commande.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="hidden rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 sm:inline-flex"
          >
            Panier ({count})
            {count > 0 ? (
              <span className="ml-2 text-white/70">
                · {formatCurrency(total)}
              </span>
            ) : null}
          </button>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-stone-600 sm:grid-cols-3">
          <MinimalInfo label="Commande" value="En ligne" />
          <MinimalInfo label="Retrait" value="Boutique / marchés" />
          <MinimalInfo label="Disponibilité" value="Selon les produits" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <div className="sticky top-[65px] z-20 -mx-4 border-y border-stone-200 bg-white/95 px-4 py-3 backdrop-blur sm:top-[73px] sm:mx-0 sm:rounded-2xl sm:border sm:shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px] lg:grid-cols-[1fr_190px_auto]">
            <label>
              <span className="sr-only">Rechercher un produit</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher..."
                className="h-11 w-full rounded-full border border-stone-200 bg-white px-4 text-sm outline-none transition focus:border-stone-950"
              />
            </label>

            <label>
              <span className="sr-only">Trier les produits</span>
              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as SortMode)
                }
                className="h-11 w-full rounded-full border border-stone-200 bg-white px-4 text-sm outline-none transition focus:border-stone-950"
              >
                <option value="recommended">Recommandé</option>
                <option value="price-asc">Prix + bas</option>
                <option value="price-desc">Prix + haut</option>
              </select>
            </label>

            <label className="flex h-11 items-center justify-between gap-3 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 lg:justify-start">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(event) => setOnlyAvailable(event.target.checked)}
                className="h-4 w-4 accent-stone-950"
              />
              Disponibles
            </label>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
                Produits
              </p>
              <h2 className="font-display mt-1 text-3xl font-semibold">
                Sélection
              </h2>
            </div>

            <p className="hidden text-sm text-stone-500 sm:block">
              {filteredArticles.length} article
              {filteredArticles.length > 1 ? 's' : ''}
            </p>
          </div>

          {articles.length === 0 ? (
            <EmptyState
              title="Aucun article disponible"
              text="La boutique n’a pas encore de produits en ligne pour le moment."
            />
          ) : filteredArticles.length === 0 ? (
            <EmptyState
              title="Aucun produit trouvé"
              text="Essayez de modifier votre recherche ou de retirer le filtre."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredArticles.map((article) => {
                const quantity = cart[article.id] ?? 0
                const disabled = article.stock <= 0

                return (
                  <article
                    key={article.id}
                    className="group overflow-hidden rounded-2xl border border-stone-200 bg-white"
                  >
                    <div className="relative">
                      <ArticleImage article={article} />
                      <div className="absolute left-3 top-3">
                        <AvailabilityBadge available={article.stock > 0} />
                      </div>
                    </div>

                    <div className="grid min-h-[220px] gap-4 p-4">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-display text-2xl font-semibold leading-tight">
                            {article.nom}
                          </h3>
                          <p className="shrink-0 font-semibold text-stone-950">
                            {formatCurrency(article.prix)}
                          </p>
                        </div>

                        {article.description ? (
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-600">
                            {article.description}
                          </p>
                        ) : (
                          <p className="mt-3 text-sm leading-6 text-stone-500">
                            Produit disponible à la commande en ligne.
                          </p>
                        )}
                      </div>

                      <div className="mt-auto">
                        {quantity === 0 ? (
                          <button
                            type="button"
                            onClick={() => updateCart(article, 1)}
                            disabled={disabled}
                            className="h-11 w-full rounded-full bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-500"
                          >
                            {disabled ? 'Indisponible' : 'Ajouter'}
                          </button>
                        ) : (
                          <div className="flex h-11 items-center justify-between rounded-full border border-stone-200 bg-stone-50 px-2">
                            <button
                              type="button"
                              onClick={() => updateCart(article, -1)}
                              className="grid h-8 w-8 place-items-center rounded-full bg-white font-semibold text-stone-950"
                              aria-label={`Retirer ${article.nom}`}
                            >
                              −
                            </button>

                            <span className="text-sm font-semibold">
                              {quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() => updateCart(article, 1)}
                              disabled={quantity >= article.stock}
                              className="grid h-8 w-8 place-items-center rounded-full bg-white font-semibold text-stone-950 disabled:opacity-40"
                              aria-label={`Ajouter ${article.nom}`}
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
        </div>
      </section>

      {count > 0 ? (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-full bg-stone-950 px-5 py-4 text-sm font-semibold text-white shadow-2xl shadow-stone-950/20 sm:hidden"
        >
          <span>
            Panier · {count} article{count > 1 ? 's' : ''}
          </span>
          <span>{formatCurrency(total)}</span>
        </button>
      ) : null}

      {panelOpen ? (
        <CartPanel
          lines={lines}
          total={total}
          loading={loading}
          error={error}
          nom={nom}
          email={email}
          tel={tel}
          lieu={lieu}
          dateRetrait={dateRetrait}
          onClose={() => setPanelOpen(false)}
          onSubmit={handleSubmit}
          onNomChange={setNom}
          onEmailChange={setEmail}
          onTelChange={setTel}
          onLieuChange={setLieu}
          onDateRetraitChange={setDateRetrait}
          onUpdateCart={updateCart}
          onRemoveFromCart={removeFromCart}
        />
      ) : null}
    </main>
  )
}

function Header({
  count,
  total,
  onCartClick,
}: {
  count: number
  total: number
  onCartClick: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/logo.svg"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full border border-stone-200 bg-white object-contain p-1"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-stone-950 sm:text-base">
              Les Cocottes de Diane
            </p>
            <p className="hidden text-xs text-stone-500 sm:block">
              Boutique en ligne
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCartClick}
          className="shrink-0 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          Panier ({count})
          {count > 0 ? (
            <span className="ml-2 hidden text-white/70 sm:inline">
              · {formatCurrency(total)}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  )
}

function MinimalInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
        {label}
      </p>
      <p className="mt-1 font-medium text-stone-950">{value}</p>
    </div>
  )
}

function AvailabilityBadge({ available }: { available: boolean }) {
  if (!available) {
    return (
      <span className="rounded-full bg-stone-950/85 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
        Indisponible
      </span>
    )
  }

  return (
    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-stone-900 shadow-sm backdrop-blur">
      Disponible
    </span>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
      <p className="font-display text-3xl font-semibold text-stone-950">
        {title}
      </p>
      <p className="mt-2 text-sm text-stone-600">{text}</p>
    </div>
  )
}

function CartPanel({
  lines,
  total,
  loading,
  error,
  nom,
  email,
  tel,
  lieu,
  dateRetrait,
  onClose,
  onSubmit,
  onNomChange,
  onEmailChange,
  onTelChange,
  onLieuChange,
  onDateRetraitChange,
  onUpdateCart,
  onRemoveFromCart,
}: {
  lines: {
    article: ShopArticle
    quantite: number
    total: number
  }[]
  total: number
  loading: boolean
  error: string
  nom: string
  email: string
  tel: string
  lieu: string
  dateRetrait: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onNomChange: (value: string) => void
  onEmailChange: (value: string) => void
  onTelChange: (value: string) => void
  onLieuChange: (value: string) => void
  onDateRetraitChange: (value: string) => void
  onUpdateCart: (article: ShopArticle, delta: number) => void
  onRemoveFromCart: (articleId: number) => void
}) {
  const count = lines.reduce((sum, line) => sum + line.quantite, 0)

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Fermer le panier"
        className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <aside className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:max-w-lg sm:rounded-none">
        <div className="border-b border-stone-200 p-5">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-stone-200 sm:hidden" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Commande
              </p>
              <h2 className="font-display mt-1 text-3xl font-semibold">
                Panier
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {count} article{count > 1 ? 's' : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-stone-50"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {lines.length === 0 ? (
            <EmptyState
              title="Panier vide"
              text="Ajoutez un produit pour commencer votre commande."
            />
          ) : (
            <div className="grid gap-3">
              {lines.map((line) => (
                <div
                  key={line.article.id}
                  className="rounded-2xl border border-stone-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{line.article.nom}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        {formatCurrency(line.article.prix)} l’unité
                      </p>
                    </div>

                    <p className="font-semibold">{formatCurrency(line.total)}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onUpdateCart(line.article, -1)}
                        className="grid h-8 w-8 place-items-center rounded-full border border-stone-200 font-semibold"
                        aria-label={`Retirer ${line.article.nom}`}
                      >
                        −
                      </button>

                      <span className="min-w-6 text-center text-sm font-semibold">
                        {line.quantite}
                      </span>

                      <button
                        type="button"
                        onClick={() => onUpdateCart(line.article, 1)}
                        disabled={line.quantite >= line.article.stock}
                        className="grid h-8 w-8 place-items-center rounded-full border border-stone-200 font-semibold disabled:opacity-40"
                        aria-label={`Ajouter ${line.article.nom}`}
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveFromCart(line.article.id)}
                      className="text-sm font-medium text-stone-500 underline-offset-4 hover:text-red-700 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-5 grid gap-4 border-t border-stone-200 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">Total TTC</span>
              <strong className="text-xl">{formatCurrency(total)}</strong>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nom / Prénom *" htmlFor="minimal-nom">
                <input
                  id="minimal-nom"
                  value={nom}
                  onChange={(event) => onNomChange(event.target.value)}
                  className="h-11 rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-stone-950"
                  required
                />
              </Field>

              <Field label="Email *" htmlFor="minimal-email">
                <input
                  id="minimal-email"
                  type="email"
                  value={email}
                  onChange={(event) => onEmailChange(event.target.value)}
                  className="h-11 rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-stone-950"
                  required
                />
              </Field>
            </div>

            <Field label="Téléphone" htmlFor="minimal-tel">
              <input
                id="minimal-tel"
                type="tel"
                value={tel}
                onChange={(event) => onTelChange(event.target.value)}
                className="h-11 rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-stone-950"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Lieu de retrait *" htmlFor="minimal-lieu">
                <select
                  id="minimal-lieu"
                  value={lieu}
                  onChange={(event) => onLieuChange(event.target.value)}
                  className="h-11 rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-stone-950"
                >
                  {pickupPoints.map((point) => {
                    const value = formatPickupPoint(point)

                    return (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    )
                  })}
                </select>
              </Field>

              <Field label="Date souhaitée *" htmlFor="minimal-dateRetrait">
                <input
                  id="minimal-dateRetrait"
                  type="date"
                  min={todayInputValue()}
                  value={dateRetrait}
                  onChange={(event) => onDateRetraitChange(event.target.value)}
                  className="h-11 rounded-xl border border-stone-200 bg-white px-3 outline-none transition focus:border-stone-950"
                  required
                />
              </Field>
            </div>

            <p className="rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-500">
              Vos informations sont utilisées uniquement pour traiter cette
              commande.
            </p>

            {error ? (
              <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading || lines.length === 0}
              className="rounded-full bg-stone-950 px-5 py-4 font-semibold text-white transition hover:bg-stone-800 disabled:bg-stone-200 disabled:text-stone-500"
            >
              {loading ? 'Préparation de la commande...' : 'Valider ma commande'}
            </button>
          </form>
        </div>
      </aside>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-800">
        {label}
      </label>
      {children}
    </div>
  )
}