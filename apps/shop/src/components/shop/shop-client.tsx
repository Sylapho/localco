'use client'

import type { ShopArticle } from '@/lib/api'
import {
  buildCartLines,
  formatCurrency,
  getCartCount,
  readStoredCart,
  writeStoredCart,
  type Cart,
} from '@/lib/cart'
import { formatPickupPoint, pickupPoints } from '@/lib/pickup-points'
import ProductInfoPopover from './product-info-popover'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ShopClientProps = {
  articles: ShopArticle[]
}

type ProductCategory =
  | 'Bocaux'
  | 'Découpes'
  | 'Préparations'
  | 'Brochettes'
  | 'Œufs'
  | 'Packs'

type CategoryFilter = 'Toutes' | ProductCategory

const productCategories: ProductCategory[] = [
  'Bocaux',
  'Découpes',
  'Préparations',
  'Brochettes',
  'Œufs',
  'Packs',
]

const categories: CategoryFilter[] = ['Toutes', ...productCategories]
const maxCartQuantity = 99

function getArticleCategory(article: ShopArticle): ProductCategory {
  const text = `${article.nom} ${article.description ?? ''}`.toLowerCase()

  if (text.includes('pack')) {
    return 'Packs'
  }

  if (text.includes('œuf') || text.includes('oeuf')) {
    return 'Œufs'
  }

  if (
    text.includes('terrine') ||
    text.includes('rillettes') ||
    text.includes('mousse') ||
    text.includes('gésiers') ||
    text.includes('gesiers')
  ) {
    return 'Bocaux'
  }

  if (text.includes('brochette')) {
    return 'Brochettes'
  }

  if (
    text.includes('saucisse') ||
    text.includes('merguez') ||
    text.includes('paupiette') ||
    text.includes('ballotine') ||
    text.includes('cordon bleu') ||
    text.includes('chicken') ||
    text.includes('milanaise')
  ) {
    return 'Préparations'
  }

  return 'Découpes'
}

export default function ShopClient({ articles }: ShopClientProps) {
  const [cart, setCart] = useState<Cart>({})
  const [cartReady, setCartReady] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('Toutes')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  const [openCategories, setOpenCategories] = useState<
    Partial<Record<ProductCategory, boolean>>
  >({})

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setCart(readStoredCart())
      setCartReady(true)
    }, 0)

    return () => window.clearTimeout(handle)
  }, [])

  useEffect(() => {
    if (!cartReady) return

    writeStoredCart(cart)
  }, [cart, cartReady])

  const lines = useMemo(() => buildCartLines(cart, articles), [cart, articles])
  const total = lines.reduce((sum, line) => sum + line.totalCents, 0)
  const count = getCartCount(cart)

  const filteredArticles = articles.filter((article) => {
    const searchValue = search.trim().toLowerCase()

    const matchesSearch = searchValue
      ? `${article.nom} ${article.description ?? ''} ${article.ingredients ?? ''} ${article.allergenes ?? ''}`
          .toLowerCase()
          .includes(searchValue)
      : true

    const matchesCategory =
      category === 'Toutes' ? true : getArticleCategory(article) === category

    const matchesAvailability = onlyAvailable ? article.stock > 0 : true

    return matchesSearch && matchesCategory && matchesAvailability
  })

  const groupedArticles = productCategories
    .map((item) => ({
      category: item,
      articles: filteredArticles.filter(
        (article) => getArticleCategory(article) === item,
      ),
    }))
    .filter((group) => group.articles.length > 0)

  function isCategoryOpen(categoryName: ProductCategory, index: number) {
    return openCategories[categoryName] ?? index === 0
  }

  function toggleCategory(categoryName: ProductCategory, index: number) {
    const currentlyOpen = isCategoryOpen(categoryName, index)

    setOpenCategories((currentCategories) => ({
      ...currentCategories,
      [categoryName]: !currentlyOpen,
    }))
  }

  function updateCart(article: ShopArticle, delta: number) {
    setCart((current) => {
      const nextQuantity = Math.max(
        0,
        Math.min(maxCartQuantity, (current[article.id] ?? 0) + delta),
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

  function removeFromCart(article: ShopArticle) {
    setCart((current) => {
      const next = { ...current }
      delete next[article.id]
      return next
    })
  }

  return (
    <main className="min-h-screen bg-[#faf7f8]">
      <Header count={count} onCartClick={() => setPanelOpen(true)} />

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-14">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b5006e]">
            Commande locale premium
          </p>

          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-[#181014] sm:text-5xl">
            Des produits frais, prêts à retirer sans perdre de temps.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-[#4a3d43]">
            Choisissez vos produits, sélectionnez votre créneau de retrait, puis
            payez en ligne. Une expérience courte, élégante et pensée pour les
            commandes alimentaires locales.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href="#produits"
              className="rounded-full bg-[#b5006e] px-6 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-[#8c0055]"
            >
              Commander maintenant
            </a>

            <a
              href="#retrait"
              className="rounded-full border border-[#e8e1e4] bg-white px-6 py-3 text-center text-sm font-bold text-[#5a0037] transition hover:border-[#b5006e]"
            >
              Voir les points de retrait
            </a>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {['Paiement sécurisé', 'Préparation selon retrait', 'Retrait local'].map(
              (item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[#f0dbe6] bg-white/80 px-4 py-3 text-sm font-semibold text-[#4a3d43]"
                >
                  {item}
                </div>
              ),
            )}
          </div>
        </div>

        <div className="rounded-[2rem] bg-[#fceef6] p-5 shadow-sm lg:p-8">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.svg"
              alt="Les Cocottes de Diane"
              width={112}
              height={112}
              className="h-28 w-28 rounded-full bg-white object-contain p-3 shadow-sm"
            />

            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#b5006e]">
                Les Cocottes de Diane
              </p>
              <h2 className="mt-1 text-2xl font-black text-[#181014]">
                Boutique en ligne
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#4a3d43]">
                Une sélection courte, lisible et mise à jour selon les stocks
                disponibles.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="retrait" className="mx-auto max-w-6xl px-4 pb-4">
        <div className="rounded-[1.5rem] border border-[#f0dbe6] bg-white p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#b5006e]">
                Retrait
              </p>
              <h2 className="text-2xl font-black text-[#181014]">
                Choisissez votre point de retrait au paiement
              </h2>
            </div>

            <p className="text-sm text-[#7a6d73]">
              Marchés, ferme et AMAP selon disponibilité.
            </p>
          </div>

          <div className="mt-4 grid gap-3 text-sm text-[#4a3d43] sm:grid-cols-2 lg:grid-cols-4">
            {pickupPoints.slice(0, 4).map((point) => (
              <div
                key={formatPickupPoint(point)}
                className="rounded-2xl bg-[#faf7f8] px-4 py-3"
              >
                <p className="font-bold text-[#181014]">{point.label}</p>
                <p className="mt-1 text-[#7a6d73]">{point.schedule}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="produits" className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-[#b5006e]">
              Catalogue
            </p>
            <h2 className="text-3xl font-black text-[#181014]">
              Produits disponibles
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#7a6d73]">
              Filtrez rapidement, ajoutez au panier, puis finalisez votre retrait
              sur une page dédiée.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:min-w-[520px]">
            <label className="sr-only" htmlFor="search">
              Rechercher un produit
            </label>

            <input
              id="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un produit, un ingrédient, un allergène..."
              className="min-h-11 flex-1 rounded-full border border-[#e8e1e4] bg-white px-4 text-sm shadow-sm"
            />

            <button
              type="button"
              onClick={() => setOnlyAvailable((value) => !value)}
              className={`min-h-11 rounded-full border px-4 text-sm font-bold ${
                onlyAvailable
                  ? 'border-[#b5006e] bg-[#fceef6] text-[#8c0055]'
                  : 'border-[#e8e1e4] bg-white text-[#4a3d43]'
              }`}
            >
              En stock uniquement
            </button>
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                category === item
                  ? 'bg-[#b5006e] text-white'
                  : 'border border-[#e8e1e4] bg-white text-[#4a3d43] hover:border-[#b5006e]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {articles.length === 0 ? (
          <EmptyState message="Aucun article disponible pour le moment." />
        ) : filteredArticles.length === 0 ? (
          <EmptyState message="Aucun produit ne correspond à cette recherche." />
        ) : (
          <div className="grid gap-5">
            {groupedArticles.map((group, index) => {
              const isOpen = isCategoryOpen(group.category, index)

              return (
                <section
                  key={group.category}
                  className="overflow-hidden rounded-[1.5rem] border border-[#eee2e7] bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.category, index)}
                    className="flex w-full items-center justify-between gap-3 border-b border-[#eee2e7] bg-[#fffafb] px-4 py-3 text-left transition hover:bg-[#fceef6]"
                    aria-expanded={isOpen}
                  >
                    <div>
                      <h3 className="text-lg font-black text-[#181014]">
                        {group.category}
                      </h3>
                      <p className="mt-0.5 text-xs font-semibold text-[#7a6d73]">
                        {group.articles.length} produit
                        {group.articles.length > 1 ? 's' : ''}
                      </p>
                    </div>

                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-lg font-black text-[#5a0037] transition ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    >
                      ?
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="divide-y divide-[#eee2e7]">
                      {group.articles.map((article) => (
                        <ProductRow
                          key={article.id}
                          article={article}
                          quantity={cart[article.id] ?? 0}
                          onDecrease={() => updateCart(article, -1)}
                          onIncrease={() => updateCart(article, 1)}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
      </section>

      {count > 0 ? (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-30 rounded-full bg-[#181014] px-5 py-3 text-sm font-bold text-white shadow-lg sm:hidden"
        >
          Voir le panier · {count} article{count > 1 ? 's' : ''} ·{' '}
          {formatCurrency(total)}
        </button>
      ) : null}

      {panelOpen ? (
        <CartDrawer
          lines={lines}
          total={total}
          onClose={() => setPanelOpen(false)}
          onDecrease={(article) => updateCart(article, -1)}
          onIncrease={(article) => updateCart(article, 1)}
          onRemove={removeFromCart}
        />
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
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#5a0037] text-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.svg"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-full bg-white object-contain p-1"
            aria-hidden="true"
          />

          <div>
            <p className="font-black leading-tight">
              Les Cocottes de <span className="text-[#fde68a]">Diane</span>
            </p>
            <p className="text-xs text-white/70">Commande en ligne</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-semibold text-white/80 md:flex">
          <a href="#produits" className="hover:text-white">
            Boutique
          </a>
          <a href="#retrait" className="hover:text-white">
            Retrait
          </a>
        </nav>

        <button
          type="button"
          onClick={onCartClick}
          className="rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-bold transition hover:bg-white/25"
        >
          Panier ({count})
        </button>
      </div>
    </header>
  )
}

function ProductRow({
  article,
  quantity,
  onDecrease,
  onIncrease,
}: {
  article: ShopArticle
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <article className="grid grid-cols-[4.5rem_1fr] gap-3 p-3 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center sm:p-4">
      <ProductThumbnail article={article} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-base font-black text-[#181014]">{article.nom}</h4>

          {article.allergenes ? (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-600">
              Allergènes
            </span>
          ) : null}
        </div>

        {article.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#7a6d73]">
            {article.description}
          </p>
        ) : null}

        <div className="mt-2 max-w-2xl">
          <ProductInfoPopover
            ingredients={article.ingredients}
            allergenes={article.allergenes}
          />
        </div>
      </div>

      <div className="col-span-2 flex items-end justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
        <div className="sm:text-right">
          <p className="text-lg font-black text-[#b5006e]">
            {formatCurrency(article.prixCents)}
          </p>

        </div>

        {quantity === 0 ? (
          <button
            type="button"
            onClick={onIncrease}
            className="rounded-full bg-[#b5006e] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#8c0055]"
          >
            Ajouter
          </button>
        ) : (
          <QuantityStepper
            quantity={quantity}
            onDecrease={onDecrease}
            onIncrease={onIncrease}
          />
        )}
      </div>
    </article>
  )
}

function ProductThumbnail({ article }: { article: ShopArticle }) {
  if (article.imageUrl) {
    return (
      <div className="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-2xl bg-[#fceef6]">
        <Image
          src={article.imageUrl}
          alt={article.nom}
          fill
          sizes="72px"
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-2xl bg-[#fceef6] text-lg font-black uppercase text-[#b5006e]">
      {article.nom.slice(0, 2)}
    </div>
  )
}

function QuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
}: {
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[#e8e1e4] bg-white p-1">
      <button
        type="button"
        onClick={onDecrease}
        className="grid h-8 w-8 place-items-center rounded-full bg-[#faf7f8] font-bold"
        aria-label="Retirer un produit"
      >
        -
      </button>

      <span className="min-w-5 text-center text-sm font-black">{quantity}</span>

      <button
        type="button"
        onClick={onIncrease}
        disabled={quantity >= maxCartQuantity}
        className="grid h-8 w-8 place-items-center rounded-full bg-[#faf7f8] font-bold"
        aria-label="Ajouter un produit"
      >
        +
      </button>
    </div>
  )
}

function CartDrawer({
  lines,
  total,
  onClose,
  onDecrease,
  onIncrease,
  onRemove,
}: {
  lines: {
    article: ShopArticle
    quantite: number
    totalCents: number
  }[]
  total: number
  onClose: () => void
  onDecrease: (article: ShopArticle) => void
  onIncrease: (article: ShopArticle) => void
  onRemove: (article: ShopArticle) => void
}) {
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Fermer le panier"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#eee2e7] p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#b5006e]">
              Panier
            </p>
            <h2 className="text-xl font-black text-[#181014]">Votre commande</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#e8e1e4] px-4 py-2 text-sm font-bold text-[#4a3d43]"
          >
            Fermer
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {lines.length === 0 ? (
            <div className="rounded-2xl bg-[#faf7f8] p-5 text-sm text-[#7a6d73]">
              Votre panier est vide. Ajoutez un produit pour commencer votre
              commande.
            </div>
          ) : (
            <ul className="grid gap-3">
              {lines.map((line) => (
                <li
                  key={line.article.id}
                  className="grid gap-3 rounded-2xl border border-[#eee2e7] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-[#181014]">
                        {line.article.nom}
                      </p>
                      <p className="text-sm text-[#7a6d73]">
                        {line.quantite} x {formatCurrency(line.article.prixCents)}
                      </p>
                    </div>

                    <p className="font-black text-[#b5006e]">
                      {formatCurrency(line.totalCents)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <QuantityStepper
                      quantity={line.quantite}
                      onDecrease={() => onDecrease(line.article)}
                      onIncrease={() => onIncrease(line.article)}
                    />

                    <button
                      type="button"
                      onClick={() => onRemove(line.article)}
                      className="text-sm font-bold text-red-600"
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-4 border-t border-[#eee2e7] p-4">
          <div className="rounded-2xl bg-[#fceef6] p-3 text-xs leading-5 text-[#8c0055]">
            Le choix du point de retrait, la date et vos informations client se
            font à l’étape suivante.
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[#7a6d73]">
              Total TTC
            </span>
            <strong className="text-2xl text-[#181014]">
              {formatCurrency(total)}
            </strong>
          </div>

          <Link
            href="/checkout"
            className={`rounded-full px-4 py-3 text-center font-black text-white ${
              lines.length === 0
                ? 'pointer-events-none bg-[#181014]/30'
                : 'bg-[#b5006e] hover:bg-[#8c0055]'
            }`}
          >
            Continuer vers le paiement
          </Link>
        </div>
      </aside>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[#eee2e7] bg-white p-8 text-center text-sm text-[#7a6d73]">
      {message}
    </div>
  )
}
