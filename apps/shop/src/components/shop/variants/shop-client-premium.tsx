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

export default function ShopClientPremium({
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
    <main className="min-h-screen bg-[#120d0b] pb-28 text-white sm:pb-0">
      <Header
        count={count}
        total={total}
        onCartClick={() => setPanelOpen(true)}
      />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(190,18,60,0.32),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_28%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-6 lg:py-16">
          <div className="order-2 lg:order-1">
            <div className="inline-flex rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-rose-100">
              Boutique artisanale
            </div>

            <h1 className="font-display mt-6 max-w-3xl text-5xl font-semibold leading-[0.95] tracking-tight text-white sm:text-7xl">
              Les Cocottes de Diane
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-white/72">
              Une sélection de produits à commander en ligne, avec retrait sur
              les marchés ou à la ferme selon vos disponibilités.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#produits"
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-stone-950 transition hover:bg-rose-50"
              >
                Voir les produits
              </a>

              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/20 bg-white/8 px-6 text-sm font-semibold text-white transition hover:bg-white/12"
              >
                Panier ({count})
              </button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <PremiumStat label="Commande" value="En ligne" />
              <PremiumStat label="Retrait" value="Local" />
              <PremiumStat label="Produits" value="De saison" />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-xl">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-rose-900/25 blur-2xl" />

              <div className="relative overflow-hidden rounded-[2.25rem] border border-white/12 bg-white/10 p-3 shadow-2xl shadow-black/30 backdrop-blur">
                <div className="rounded-[1.75rem] bg-[#f7efe6] p-5 text-stone-950">
                  <div className="flex items-center gap-4">
                    <Image
                      src="/logo.svg"
                      alt="Les Cocottes de Diane"
                      width={92}
                      height={92}
                      priority
                      className="h-20 w-20 rounded-full bg-white object-contain p-2 shadow-sm"
                    />

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-800">
                        Retrait local
                      </p>
                      <p className="font-display mt-1 text-3xl font-semibold">
                        Commandez simplement
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3">
                    {pickupPoints.slice(0, 3).map((point) => (
                      <div
                        key={formatPickupPoint(point)}
                        className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
                      >
                        <p className="font-semibold">{point.label}</p>
                        <p className="mt-1 text-sm text-stone-500">
                          {point.schedule}
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm leading-6 text-rose-950">
                    La réservation est confirmée après validation de la
                    commande.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="produits"
        className="rounded-t-[2rem] bg-[#fffaf5] px-4 py-8 text-stone-950 sm:rounded-t-[3rem] sm:py-12 lg:px-6"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-800">
                Sélection premium
              </p>

              <h2 className="font-display mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                Produits du moment
              </h2>
            </div>

            <p className="max-w-md text-sm leading-7 text-stone-500">
              Une boutique plus élégante, pensée mobile-first, avec un parcours
              simple : choisir, retirer, valider.
            </p>
          </div>

          <div className="sticky top-[72px] z-20 mt-6 rounded-[1.75rem] border border-stone-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto] lg:items-center">
              <label className="block">
                <span className="sr-only">Rechercher un produit</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher un produit..."
                  className="h-12 w-full rounded-full border border-stone-200 bg-stone-50 px-5 text-sm outline-none transition focus:border-rose-800 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="sr-only">Trier les produits</span>
                <select
                  value={sortMode}
                  onChange={(event) =>
                    setSortMode(event.target.value as SortMode)
                  }
                  className="h-12 w-full rounded-full border border-stone-200 bg-stone-50 px-5 text-sm outline-none transition focus:border-rose-800 focus:bg-white"
                >
                  <option value="recommended">Tri recommandé</option>
                  <option value="price-asc">Prix croissant</option>
                  <option value="price-desc">Prix décroissant</option>
                </select>
              </label>

              <label className="flex h-12 items-center justify-between gap-3 rounded-full border border-stone-200 bg-stone-50 px-5 text-sm font-medium text-stone-700 lg:justify-start">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(event) => setOnlyAvailable(event.target.checked)}
                  className="h-4 w-4 accent-rose-800"
                />
                Articles disponibles
              </label>
            </div>
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
            <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filteredArticles.map((article, index) => {
                const quantity = cart[article.id] ?? 0
                const disabled = article.stock <= 0
                const featured = index === 0

                return (
                  <article
                    key={article.id}
                    className={`group overflow-hidden border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-stone-200/80 ${
                      featured
                        ? 'rounded-[2rem] sm:col-span-2 xl:col-span-1'
                        : 'rounded-[2rem]'
                    }`}
                  >
                    <div className="relative">
                      <ArticleImage article={article} />

                      <div className="absolute left-4 top-4">
                        <AvailabilityBadge available={article.stock > 0} />
                      </div>

                      {featured ? (
                        <div className="absolute bottom-4 left-4 rounded-full bg-stone-950/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur">
                          Mise en avant
                        </div>
                      ) : null}
                    </div>

                    <div className="grid min-h-[250px] gap-5 p-5 sm:p-6">
                      <div>
                        <h3 className="font-display text-3xl font-semibold leading-tight text-stone-950">
                          {article.nom}
                        </h3>

                        {article.description ? (
                          <p className="mt-3 line-clamp-3 text-sm leading-7 text-stone-600">
                            {article.description}
                          </p>
                        ) : (
                          <p className="mt-3 text-sm leading-7 text-stone-500">
                            Produit disponible à la commande en ligne.
                          </p>
                        )}
                      </div>

                      <div className="mt-auto grid gap-4">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <p className="text-2xl font-semibold text-rose-900">
                              {formatCurrency(article.prix)}
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                              Prix TTC · Retrait sur place
                            </p>
                          </div>
                        </div>

                        {quantity === 0 ? (
                          <button
                            type="button"
                            onClick={() => updateCart(article, 1)}
                            disabled={disabled}
                            className="h-12 rounded-full bg-rose-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-950 disabled:bg-stone-200 disabled:text-stone-500"
                          >
                            {disabled ? 'Indisponible' : 'Ajouter au panier'}
                          </button>
                        ) : (
                          <div className="flex h-12 items-center justify-between rounded-full border border-rose-100 bg-rose-50 px-2">
                            <button
                              type="button"
                              onClick={() => updateCart(article, -1)}
                              className="grid h-9 w-9 place-items-center rounded-full bg-white font-semibold text-rose-800 shadow-sm"
                              aria-label={`Retirer ${article.nom}`}
                            >
                              −
                            </button>

                            <div className="text-center">
                              <p className="text-sm font-semibold text-rose-900">
                                {quantity}
                              </p>
                              <p className="text-[10px] uppercase tracking-wide text-rose-700">
                                au panier
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => updateCart(article, 1)}
                              disabled={quantity >= article.stock}
                              className="grid h-9 w-9 place-items-center rounded-full bg-white font-semibold text-rose-800 shadow-sm disabled:opacity-40"
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
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-full bg-rose-900 px-5 py-4 text-sm font-semibold text-white shadow-2xl shadow-rose-950/25 sm:hidden"
        >
          <span>
            Voir le panier · {count} article{count > 1 ? 's' : ''}
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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#120d0b]/90 text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:py-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/logo.svg"
            alt=""
            width={48}
            height={48}
            className="h-10 w-10 shrink-0 rounded-full bg-white object-contain p-1 sm:h-12 sm:w-12"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <p className="font-display truncate text-lg font-semibold leading-none sm:text-xl">
              Les Cocottes de Diane
            </p>
            <p className="mt-1 hidden text-xs uppercase tracking-[0.18em] text-white/45 sm:block">
              Boutique artisanale
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCartClick}
          className="shrink-0 rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-rose-50"
        >
          Panier ({count})
          {count > 0 ? (
            <span className="ml-2 hidden text-stone-500 sm:inline">
              · {formatCurrency(total)}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  )
}

function PremiumStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/8 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <p className="font-display mt-2 text-2xl font-semibold text-white">
        {value}
      </p>
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
    <div className="mt-6 rounded-[2rem] border border-dashed border-stone-300 bg-white p-8 text-center sm:p-10">
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
        className="absolute inset-0 bg-stone-950/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <aside className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] bg-[#fffaf5] text-stone-950 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:max-w-xl sm:rounded-none">
        <div className="border-b border-stone-200 bg-white p-5">
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-stone-200 sm:hidden" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-800">
                Votre commande
              </p>
              <h2 className="font-display mt-1 text-4xl font-semibold">
                Mon panier
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {count} article{count > 1 ? 's' : ''} sélectionné
                {count > 1 ? 's' : ''}
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

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-5 p-4 sm:p-5">
            {lines.length === 0 ? (
              <EmptyState
                title="Votre panier est vide"
                text="Ajoutez un produit pour commencer votre commande."
              />
            ) : (
              <div className="grid gap-3">
                {lines.map((line) => (
                  <div
                    key={line.article.id}
                    className="rounded-3xl border border-stone-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-display text-xl font-semibold">
                          {line.article.nom}
                        </p>
                        <p className="mt-1 text-sm text-stone-600">
                          {formatCurrency(line.article.prix)} l’unité
                        </p>
                      </div>

                      <p className="font-semibold text-rose-900">
                        {formatCurrency(line.total)}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onUpdateCart(line.article, -1)}
                          className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-white font-semibold text-rose-800"
                          aria-label={`Retirer ${line.article.nom}`}
                        >
                          −
                        </button>

                        <span className="min-w-6 text-center font-semibold">
                          {line.quantite}
                        </span>

                        <button
                          type="button"
                          onClick={() => onUpdateCart(line.article, 1)}
                          disabled={line.quantite >= line.article.stock}
                          className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-white font-semibold text-rose-800 disabled:opacity-40"
                          aria-label={`Ajouter ${line.article.nom}`}
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemoveFromCart(line.article.id)}
                        className="text-sm font-semibold text-stone-500 underline-offset-4 hover:text-red-700 hover:underline"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="rounded-3xl border border-rose-100 bg-rose-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rose-900">
                    Total TTC
                  </span>
                  <strong className="text-2xl text-rose-900">
                    {formatCurrency(total)}
                  </strong>
                </div>

                <p className="mt-2 text-xs leading-5 text-rose-800">
                  Vos informations sont utilisées uniquement pour traiter cette
                  commande.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nom / Prénom *" htmlFor="premium-nom">
                  <input
                    id="premium-nom"
                    value={nom}
                    onChange={(event) => onNomChange(event.target.value)}
                    className="h-12 rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-rose-800"
                    required
                  />
                </Field>

                <Field label="Email *" htmlFor="premium-email">
                  <input
                    id="premium-email"
                    type="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    className="h-12 rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-rose-800"
                    required
                  />
                </Field>
              </div>

              <Field label="Téléphone" htmlFor="premium-tel">
                <input
                  id="premium-tel"
                  type="tel"
                  value={tel}
                  onChange={(event) => onTelChange(event.target.value)}
                  className="h-12 rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-rose-800"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Lieu de retrait *" htmlFor="premium-lieu">
                  <select
                    id="premium-lieu"
                    value={lieu}
                    onChange={(event) => onLieuChange(event.target.value)}
                    className="h-12 rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-rose-800"
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

                <Field label="Date souhaitée *" htmlFor="premium-dateRetrait">
                  <input
                    id="premium-dateRetrait"
                    type="date"
                    min={todayInputValue()}
                    value={dateRetrait}
                    onChange={(event) =>
                      onDateRetraitChange(event.target.value)
                    }
                    className="h-12 rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-rose-800"
                    required
                  />
                </Field>
              </div>

              {error ? (
                <p className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading || lines.length === 0}
                className="rounded-full bg-rose-900 px-5 py-4 font-semibold text-white transition hover:bg-stone-950 disabled:bg-stone-200 disabled:text-stone-500"
              >
                {loading
                  ? 'Préparation de la commande...'
                  : 'Valider ma commande'}
              </button>
            </form>
          </div>
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
      <label htmlFor={htmlFor} className="text-sm font-semibold text-stone-800">
        {label}
      </label>
      {children}
    </div>
  )
}