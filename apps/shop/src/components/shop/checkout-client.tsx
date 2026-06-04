'use client'

import type { CreateCommandePayload, ShopArticle } from '@/lib/api'
import {
  buildCartLines,
  clearStoredCart,
  formatCurrency,
  readStoredCart,
  type Cart,
} from '@/lib/cart'
import {
  findPickupPoint,
  formatPickupDateLabel,
  formatPickupPoint,
  getAllowedPickupWeekdays,
  getNextPickupDates,
  pickupPoints,
} from '@/lib/pickup-points'
import Link from 'next/link'
import type * as React from 'react'
import { useEffect, useMemo, useState } from 'react'

type CheckoutClientProps = {
  articles: ShopArticle[]
  apiUrl: string
}

const inputClassName =
  'min-h-12 rounded-2xl border border-[#e8e1e4] bg-white px-4 text-sm text-[#181014] shadow-sm outline-none transition focus:border-[#b5006e] focus:ring-4 focus:ring-[#fceef6]'

export default function CheckoutClient({
  articles,
  apiUrl,
}: CheckoutClientProps) {
  const [cart, setCart] = useState<Cart>({})
  const [cartReady, setCartReady] = useState(false)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')
  const [lieu, setLieu] = useState(formatPickupPoint(pickupPoints[0]))
  const [dateRetrait, setDateRetrait] = useState(
    getNextPickupDates(pickupPoints[0], 1)[0],
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const lines = useMemo(() => buildCartLines(cart, articles), [cart, articles])
  const total = lines.reduce((sum, line) => sum + line.total, 0)
  const itemCount = lines.reduce((sum, line) => sum + line.quantite, 0)
  const selectedPickupPoint = findPickupPoint(lieu) ?? pickupPoints[0]
  const pickupDateOptions = useMemo(
    () => getNextPickupDates(selectedPickupPoint),
    [selectedPickupPoint],
  )
  const selectedDateRetrait = pickupDateOptions.includes(dateRetrait)
    ? dateRetrait
    : pickupDateOptions[0]

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setCart(readStoredCart())
      setCartReady(true)
    }, 0)

    return () => window.clearTimeout(handle)
  }, [])

  function handlePickupPointChange(value: string) {
    const nextPickupPoint = findPickupPoint(value) ?? pickupPoints[0]
    setLieu(value)
    setDateRetrait(getNextPickupDates(nextPickupPoint, 1)[0])
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (lines.length === 0) {
      setError('Votre panier est vide.')
      return
    }

    if (!pickupDateOptions.includes(selectedDateRetrait)) {
      setError('La date choisie ne correspond pas au lieu de retrait.')
      return
    }

    setLoading(true)

    try {
      const payload: CreateCommandePayload = {
        nom,
        email,
        tel: tel || undefined,
        lieu,
        dateRetrait: selectedDateRetrait,
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
        throw new Error(text || 'Impossible de préparer le paiement')
      }

      const checkout = (await response.json()) as {
        url: string
      }

      clearStoredCart()
      window.location.assign(checkout.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffafb_0%,#faf7f8_38%,#f7edf2_100%)] px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-[1.5rem] border border-[#f0dbe6] bg-white/85 p-5 shadow-sm backdrop-blur sm:p-6">
          <Link
            href="/"
            className="inline-flex rounded-full bg-[#fceef6] px-4 py-2 text-sm font-bold text-[#8c0055] hover:text-[#5a0037]"
          >
            ← Retour à la boutique
          </Link>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b5006e]">
                Paiement sécurisé
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#181014] sm:text-4xl">
                Finaliser ma commande
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a6d73]">
                Renseignez vos informations, choisissez votre retrait, puis vous
                serez redirigé vers le paiement sécurisé.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold text-[#5a0037] sm:min-w-80">
              <div className="rounded-2xl bg-[#fceef6] px-3 py-3">
                1. Coordonnées
              </div>
              <div className="rounded-2xl bg-[#fceef6] px-3 py-3">
                2. Retrait
              </div>
              <div className="rounded-2xl bg-[#fceef6] px-3 py-3">
                3. Paiement
              </div>
            </div>
          </div>
        </div>

        {!cartReady ? (
          <div className="rounded-[1.5rem] border border-[#eee2e7] bg-white p-8 shadow-sm">
            <h2 className="text-xl font-black text-[#181014]">
              Chargement du panier
            </h2>
            <p className="mt-2 text-sm text-[#7a6d73]">
              Nous préparons les informations de votre commande.
            </p>
          </div>
        ) : lines.length === 0 ? (
          <div className="rounded-[1.5rem] border border-[#eee2e7] bg-white p-8 shadow-sm">
            <h2 className="text-xl font-black text-[#181014]">
              Votre panier est vide
            </h2>
            <p className="mt-2 text-sm text-[#7a6d73]">
              Ajoutez au moins un produit avant de passer au paiement.
            </p>
            <Link
              href="/#produits"
              className="mt-5 inline-flex rounded-full bg-[#b5006e] px-5 py-3 text-sm font-bold text-white"
            >
              Voir les produits
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
            <form
              id="checkout-form"
              onSubmit={handleSubmit}
              className="grid gap-5 rounded-[1.5rem] border border-[#eee2e7] bg-white p-5 shadow-sm sm:p-6"
            >
              <section>
                <StepHeader
                  eyebrow="Étape 1"
                  title="Vos informations"
                  description="Ces informations servent uniquement à préparer votre retrait et à vous contacter si besoin."
                />

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    className="sm:col-span-2"
                    label="Nom / Prénom *"
                    htmlFor="nom"
                  >
                    <input
                      id="nom"
                      value={nom}
                      onChange={(event) => setNom(event.target.value)}
                      autoComplete="name"
                      className={inputClassName}
                      required
                    />
                  </Field>

                  <Field label="Email *" htmlFor="email">
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      className={inputClassName}
                      required
                    />
                  </Field>

                  <Field label="Téléphone" htmlFor="tel">
                    <input
                      id="tel"
                      type="tel"
                      value={tel}
                      onChange={(event) => setTel(event.target.value)}
                      autoComplete="tel"
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </section>

              <section className="border-t border-[#eee2e7] pt-5">
                <StepHeader
                  eyebrow="Étape 2"
                  title="Retrait"
                  description="La date proposée dépend du lieu sélectionné, pour éviter une commande sur un jour impossible."
                />

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Lieu de retrait *" htmlFor="lieu">
                    <select
                      id="lieu"
                      value={lieu}
                      onChange={(event) =>
                        handlePickupPointChange(event.target.value)
                      }
                      className={inputClassName}
                      required
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

                  <Field label="Date souhaitée *" htmlFor="dateRetrait">
                    <select
                      id="dateRetrait"
                      value={selectedDateRetrait}
                      onChange={(event) => setDateRetrait(event.target.value)}
                      className={inputClassName}
                      required
                    >
                      {pickupDateOptions.map((date) => (
                        <option key={date} value={date}>
                          {formatPickupDateLabel(date)}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-[#7a6d73]">
                      Dates proposées uniquement le{' '}
                      {getAllowedPickupWeekdays(selectedPickupPoint)} pour ce
                      point de retrait.
                    </p>
                  </Field>
                </div>
              </section>

              <section className="grid gap-3 rounded-2xl bg-[#fceef6] p-4 text-sm leading-6 text-[#8c0055] sm:grid-cols-[auto_1fr] sm:items-start">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white font-black">
                  ✓
                </span>
                <div>
                  <p className="font-black text-[#5a0037]">
                    Paiement sécurisé par Stripe
                  </p>
                  <p>
                    Vous allez être redirigé vers le paiement sécurisé. Vos
                    informations sont utilisées uniquement pour traiter cette
                    commande.
                  </p>
                </div>
              </section>

              {error ? (
                <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-[#b5006e] px-5 py-4 font-black text-white shadow-sm transition hover:bg-[#8c0055] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? 'Préparation du paiement...'
                  : `Payer ${formatCurrency(total)}`}
              </button>
            </form>

            <aside className="rounded-[1.5rem] border border-[#eee2e7] bg-white p-5 shadow-sm lg:sticky lg:top-24">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-[#b5006e]">
                    Récapitulatif
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-[#181014]">
                    Votre panier
                  </h2>
                </div>

                <span className="rounded-full bg-[#fceef6] px-3 py-1 text-xs font-black text-[#8c0055]">
                  {itemCount} article{itemCount > 1 ? 's' : ''}
                </span>
              </div>

              <ul className="mt-4 grid max-h-72 gap-3 overflow-y-auto pr-1">
                {lines.map((line) => (
                  <li
                    key={line.article.id}
                    className="flex items-start justify-between gap-3 border-b border-[#eee2e7] pb-3"
                  >
                    <div>
                      <p className="font-bold text-[#181014]">
                        {line.article.nom}
                      </p>
                      <p className="text-sm text-[#7a6d73]">
                        {line.quantite} x {formatCurrency(line.article.prix)}
                      </p>
                    </div>
                    <p className="font-black text-[#b5006e]">
                      {formatCurrency(line.total)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-5 grid gap-3 rounded-2xl bg-[#faf7f8] p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[#7a6d73]">Retrait</span>
                  <span className="max-w-48 text-right font-bold text-[#181014]">
                    {lieu}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-[#7a6d73]">Date</span>
                  <span className="font-bold text-[#181014]">
                    {formatPickupDateLabel(selectedDateRetrait)}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#7a6d73]">
                  Total TTC
                </span>
                <strong className="text-3xl text-[#181014]">
                  {formatCurrency(total)}
                </strong>
              </div>

              <button
                type="submit"
                form="checkout-form"
                disabled={loading}
                className="mt-5 hidden w-full rounded-full bg-[#181014] px-5 py-3 text-sm font-black text-white transition hover:bg-[#3a2a31] disabled:cursor-not-allowed disabled:opacity-50 lg:block"
              >
                {loading ? 'Préparation...' : 'Continuer vers le paiement'}
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

function StepHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>
      <p className="text-sm font-bold uppercase tracking-wide text-[#b5006e]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-black text-[#181014]">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-[#7a6d73]">
        {description}
      </p>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string
  htmlFor: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ''}`}>
      <label htmlFor={htmlFor} className="text-sm font-bold text-[#181014]">
        {label}
      </label>
      {children}
    </div>
  )
}
