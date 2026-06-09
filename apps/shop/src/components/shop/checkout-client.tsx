'use client'

import type { CreateCommandePayload, PickupPoint, ShopArticle } from '@/lib/api'
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
} from '@/lib/pickup-points'
import Link from 'next/link'
import type * as React from 'react'
import { useEffect, useMemo, useState } from 'react'

type CheckoutClientProps = {
  articles: ShopArticle[]
  apiUrl: string
  pickupPoints: PickupPoint[]
}

type CheckoutError = {
  title: string
  message: string
  details?: string[]
  actionHref?: string
  actionLabel?: string
}

type StockIssue = {
  nom?: string
  requested?: number
  sellableStock?: number
}

type ApiErrorPayload = {
  statusCode?: number
  message?:
  | string
  | string[]
  | {
    message?: string
    insufficientStock?: StockIssue[]
  }
  error?: string
  insufficientStock?: StockIssue[]
}

const inputClassName =
  'min-h-12 rounded-2xl border border-[#e8e1e4] bg-white px-4 text-sm text-[#181014] shadow-sm outline-none transition focus:border-[#b5006e] focus:ring-4 focus:ring-[#fceef6]'

export default function CheckoutClient({
  articles,
  apiUrl,
  pickupPoints,
}: CheckoutClientProps) {
  const firstPickupPoint = pickupPoints[0]
  const [cart, setCart] = useState<Cart>({})
  const [cartReady, setCartReady] = useState(false)

  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [tel, setTel] = useState('')

  const [lieu, setLieu] = useState(
    firstPickupPoint ? formatPickupPoint(firstPickupPoint) : '',
  )
  const [dateRetrait, setDateRetrait] = useState(
    firstPickupPoint ? (getNextPickupDates(firstPickupPoint, 1)[0] ?? '') : '',
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<CheckoutError | null>(null)

  const lines = useMemo(() => buildCartLines(cart, articles), [cart, articles])
  const total = lines.reduce((sum, line) => sum + line.totalCents, 0)
  const itemCount = lines.reduce((sum, line) => sum + line.quantite, 0)

  const selectedPickupPoint =
    findPickupPoint(pickupPoints, lieu) ?? firstPickupPoint

  const pickupDateOptions = useMemo(
    () => (selectedPickupPoint ? getNextPickupDates(selectedPickupPoint) : []),
    [selectedPickupPoint],
  )

  const selectedDateRetrait = pickupDateOptions.includes(dateRetrait)
    ? dateRetrait
    : (pickupDateOptions[0] ?? '')

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setCart(readStoredCart())
      setCartReady(true)
    }, 0)

    return () => window.clearTimeout(handle)
  }, [])

  function handlePickupPointChange(value: string) {
    const nextPickupPoint = findPickupPoint(pickupPoints, value)

    setLieu(value)
    setDateRetrait(
      nextPickupPoint ? (getNextPickupDates(nextPickupPoint, 1)[0] ?? '') : '',
    )
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (lines.length === 0) {
      setError({
        title: 'Panier vide',
        message: 'Ajoutez au moins un produit avant de passer au paiement.',
        actionHref: '/#produits',
        actionLabel: 'Voir les produits',
      })
      return
    }

    if (!selectedPickupPoint) {
      setError({
        title: 'Point de retrait indisponible',
        message:
          'Aucun point de retrait ne peut Ãªtre proposÃ© pour le moment. RÃ©essayez plus tard.',
      })
      return
    }

    if (!pickupDateOptions.includes(selectedDateRetrait)) {
      setError({
        title: 'Date de retrait invalide',
        message:
          'La date choisie ne correspond pas au lieu de retrait sélectionné.',
      })
      return
    }

    setLoading(true)

    try {
      const payload: CreateCommandePayload = {
        nom,
        email,
        tel: tel || undefined,
        lieu: formatPickupPoint(selectedPickupPoint),
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
        setError(await readCheckoutError(response))
        return
      }

      const checkout = (await response.json()) as {
        url: string
      }

      if (!checkout.url) {
        setError({
          title: 'Paiement indisponible',
          message:
            'Le paiement ne peut pas être préparé pour le moment. Réessayez dans quelques minutes.',
        })
        return
      }

      clearStoredCart()
      window.location.assign(checkout.url)
    } catch (err) {
      setError(getNetworkCheckoutError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffafb_0%,#faf7f8_38%,#f7edf2_100%)] px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 rounded-[1.5rem] border border-[#f0dbe6] bg-white/85 p-5 shadow-sm backdrop-blur sm:p-6">
          <Link
            href="/"
            className="inline-flex rounded-full bg-[#fceef6] px-4 py-2 text-sm font-bold text-[#8c0055] hover:text-[#5a0037]"
          >
            ← Retour à la boutique
          </Link>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b5006e]">
                Click & Collect
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#181014] sm:text-4xl">
                Finaliser mon retrait
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7a6d73]">
                Choisissez où et quand récupérer votre commande, renseignez vos
                coordonnées, puis validez le paiement.
              </p>
            </div>

            <div className="rounded-2xl border border-[#eee2e7] bg-white px-4 py-3 text-sm font-bold text-[#5a0037] shadow-sm">
              Retrait local → Coordonnées → Paiement
            </div>
          </div>
        </header>

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
                  title="Choisir mon retrait"
                  description="Sélectionnez un point de retrait, puis une date compatible avec ce lieu."
                />

                {pickupPoints.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {pickupPoints.map((point) => {
                      const value = formatPickupPoint(point)
                      const selected = value === lieu

                      return (
                        <PickupPointCard
                          key={value}
                          point={point}
                          selected={selected}
                          onSelect={() => handlePickupPointChange(value)}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    Aucun point de retrait nâ€™est disponible pour le moment.
                  </div>
                )}

                <div className="mt-5 grid gap-1.5">
                  <label
                    htmlFor="dateRetrait"
                    className="text-sm font-bold text-[#181014]"
                  >
                    Date disponible *
                  </label>

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

                  <p className="text-xs leading-5 text-[#7a6d73]">
                    Dates proposées uniquement le{' '}
                    {getAllowedPickupWeekdays(selectedPickupPoint)} pour ce
                    point de retrait.
                  </p>
                </div>
              </section>

              <section className="border-t border-[#eee2e7] pt-5">
                <StepHeader
                  eyebrow="Étape 2"
                  title="Vos coordonnées"
                  description="Ces informations servent à confirmer la commande et à vous contacter uniquement si nécessaire."
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

                  <Field
                    label="Email *"
                    htmlFor="email"
                    hint="Pour recevoir la confirmation de commande."
                  >
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

                  <Field
                    label="Téléphone — optionnel"
                    htmlFor="tel"
                    hint="Utile uniquement en cas de problème sur le retrait."
                  >
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
                  eyebrow="Étape 3"
                  title="Validation"
                  description="Vérifiez votre retrait et votre panier avant d’être redirigé vers le paiement sécurisé."
                />

                <div className="mt-4 rounded-2xl bg-[#fceef6] p-4 text-sm leading-6 text-[#8c0055]">
                  <p className="font-black text-[#5a0037]">
                    Paiement par Stripe
                  </p>
                  <p>
                    Vous serez redirigé vers une page de paiement sécurisée.
                    Votre commande sera confirmée après validation du paiement.
                  </p>
                </div>

                <div className="mt-3 rounded-2xl border border-[#f0dbe6] bg-white p-4 text-sm leading-6 text-[#4a3d43]">
                  <p className="font-black text-[#181014]">
                    Préparation de votre commande
                  </p>
                  <p>
                    Certains produits peuvent nécessiter une préparation avant le retrait. La
                    date proposée permet à l’équipe de préparer votre commande dans les
                    meilleures conditions.
                  </p>
                </div>

                <p className="mt-3 text-xs leading-5 text-[#7a6d73]">
                  En continuant, vous acceptez les{' '}
                  <Link href="/cgv" className="font-bold text-[#8c0055]">
                    CGV
                  </Link>{' '}
                  et la{' '}
                  <Link
                    href="/confidentialite"
                    className="font-bold text-[#8c0055]"
                  >
                    politique de confidentialité
                  </Link>
                  .
                </p>

                <p className="mt-3 text-xs leading-5 text-[#7a6d73]">
                  En continuant, vous acceptez les{' '}
                  <Link href="/cgv" className="font-bold text-[#8c0055]">
                    CGV
                  </Link>{' '}
                  et la{' '}
                  <Link
                    href="/confidentialite"
                    className="font-bold text-[#8c0055]"
                  >
                    politique de confidentialité
                  </Link>
                  .
                </p>
              </section>

              {error ? <CheckoutErrorNotice error={error} /> : null}
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
                        {line.quantite} x {formatCurrency(line.article.prixCents)}
                      </p>
                    </div>

                    <p className="font-black text-[#b5006e]">
                      {formatCurrency(line.totalCents)}
                    </p>
                  </li>
                ))}
              </ul>

              <Link
                href="/#produits"
                className="mt-3 inline-flex text-sm font-bold text-[#8c0055] hover:text-[#5a0037]"
              >
                Modifier mon panier
              </Link>

              <div className="mt-5 grid gap-3 rounded-2xl bg-[#faf7f8] p-4 text-sm">
                <div className="grid gap-1">
                  <span className="text-[#7a6d73]">Retrait</span>
                  <span className="font-bold text-[#181014]">
                    {selectedPickupPoint?.label ?? 'Non disponible'}
                  </span>
                  {selectedPickupPoint ? (
                    <span className="text-xs text-[#7a6d73]">
                      {selectedPickupPoint.schedule}
                    </span>
                  ) : null}
                </div>

                <div className="flex justify-between gap-4 border-t border-[#eee2e7] pt-3">
                  <span className="text-[#7a6d73]">Date</span>
                  <span className="text-right font-bold text-[#181014]">
                    {selectedDateRetrait
                      ? formatPickupDateLabel(selectedDateRetrait)
                      : '-'}
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
                className="mt-5 w-full rounded-full bg-[#b5006e] px-5 py-4 text-sm font-black text-white shadow-sm transition hover:bg-[#8c0055] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? 'Préparation du paiement...'
                  : 'Continuer vers le paiement sécurisé'}
              </button>

              <p className="mt-3 text-center text-xs leading-5 text-[#7a6d73]">
                Total à payer :{' '}
                <span className="font-black text-[#181014]">
                  {formatCurrency(total)}
                </span>
              </p>
            </aside>
          </div>
        )}
      </div>
    </main>
  )
}

async function readCheckoutError(response: Response): Promise<CheckoutError> {
  const payload = await readApiErrorPayload(response)
  const stockIssues = extractStockIssues(payload)

  if (stockIssues.length > 0) {
    return {
      title: 'Stock insuffisant',
      message:
        'Certains produits ne sont plus disponibles dans les quantités demandées.',
      details: stockIssues.map(formatStockIssue),
      actionHref: '/#produits',
      actionLabel: 'Ajuster mon panier',
    }
  }

  if (response.status === 429) {
    return {
      title: 'Trop de tentatives',
      message:
        'Veuillez patienter un instant avant de relancer la préparation du paiement.',
    }
  }

  if (response.status >= 500) {
    return {
      title: 'Paiement indisponible',
      message:
        'Le paiement est temporairement indisponible. Réessayez dans quelques minutes.',
    }
  }

  const messages = extractApiMessages(payload)
  const normalizedMessage = messages.join(' ').toLowerCase()

  if (
    normalizedMessage.includes('stripe') ||
    normalizedMessage.includes('paiement')
  ) {
    return {
      title: 'Paiement indisponible',
      message:
        'Le paiement ne peut pas être préparé pour le moment. Réessayez dans quelques minutes.',
    }
  }

  if (normalizedMessage.includes('lieu de retrait')) {
    return {
      title: 'Point de retrait invalide',
      message:
        'Le point de retrait sélectionné n’est plus valide. Choisissez un autre retrait puis réessayez.',
    }
  }

  if (normalizedMessage.includes('date de retrait')) {
    return {
      title: 'Date de retrait invalide',
      message:
        'La date de retrait ne correspond plus au point choisi. Sélectionnez une autre date.',
    }
  }

  if (
    normalizedMessage.includes('introuvable') ||
    normalizedMessage.includes('indisponible')
  ) {
    return {
      title: 'Panier à mettre à jour',
      message:
        'Un produit de votre panier n’est plus disponible à la commande.',
      actionHref: '/#produits',
      actionLabel: 'Modifier mon panier',
    }
  }

  if (messages.length > 0) {
    return {
      title: 'Informations à corriger',
      message: 'Vérifiez les champs du formulaire avant de continuer.',
      details: unique(messages.map(formatValidationMessage)),
    }
  }

  return {
    title: 'Paiement impossible',
    message:
      'La commande n’a pas pu être préparée. Vérifiez votre panier puis réessayez.',
  }
}

async function readApiErrorPayload(
  response: Response,
): Promise<ApiErrorPayload | null> {
  const contentType = response.headers.get('content-type') ?? ''

  try {
    if (contentType.includes('application/json')) {
      return (await response.json()) as ApiErrorPayload
    }

    const text = await response.text()

    if (!text) {
      return null
    }

    try {
      return JSON.parse(text) as ApiErrorPayload
    } catch {
      return { message: text }
    }
  } catch {
    return null
  }
}

function extractStockIssues(payload: ApiErrorPayload | null): StockIssue[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload.insufficientStock)) {
    return payload.insufficientStock
  }

  if (
    payload.message &&
    typeof payload.message === 'object' &&
    !Array.isArray(payload.message) &&
    Array.isArray(payload.message.insufficientStock)
  ) {
    return payload.message.insufficientStock
  }

  return []
}

function extractApiMessages(payload: ApiErrorPayload | null): string[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload.message)) {
    return payload.message
  }

  if (typeof payload.message === 'string') {
    return [payload.message]
  }

  if (
    payload.message &&
    typeof payload.message === 'object' &&
    typeof payload.message.message === 'string'
  ) {
    return [payload.message.message]
  }

  return typeof payload.error === 'string' ? [payload.error] : []
}

function formatStockIssue(issue: StockIssue) {
  const name = issue.nom ?? 'Produit'
  const requested = issue.requested ?? 0
  const available = Math.max(0, issue.sellableStock ?? 0)

  if (requested > 0) {
    return `${name} : ${requested} demandé${requested > 1 ? 's' : ''}, ${available} disponible${available > 1 ? 's' : ''}`
  }

  return `${name} : ${available} disponible${available > 1 ? 's' : ''}`
}

function formatValidationMessage(message: string) {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('email')) {
    return 'L’adresse email n’est pas valide.'
  }

  if (normalizedMessage.includes('nom')) {
    return 'Le nom est obligatoire et doit rester raisonnablement court.'
  }

  if (normalizedMessage.includes('tel')) {
    return 'Le téléphone contient des caractères non autorisés.'
  }

  if (normalizedMessage.includes('dateretrait')) {
    return 'La date de retrait est invalide.'
  }

  if (normalizedMessage.includes('lieu')) {
    return 'Le point de retrait est invalide.'
  }

  if (normalizedMessage.includes('quantite')) {
    return 'Une quantité du panier est invalide.'
  }

  if (normalizedMessage.includes('lignes')) {
    return 'Le panier contient une ligne invalide.'
  }

  return 'Une information du formulaire est invalide.'
}

function getNetworkCheckoutError(error: unknown): CheckoutError {
  if (error instanceof TypeError) {
    return {
      title: 'Connexion impossible',
      message:
        'Impossible de joindre le service de commande. Vérifiez votre connexion puis réessayez.',
    }
  }

  return {
    title: 'Paiement impossible',
    message:
      error instanceof Error
        ? error.message
        : 'La commande n’a pas pu être préparée. Réessayez dans quelques instants.',
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values))
}

function CheckoutErrorNotice({ error }: { error: CheckoutError }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <p className="font-black text-red-900">{error.title}</p>
      <p className="mt-1 leading-6">{error.message}</p>

      {error.details?.length ? (
        <ul className="mt-3 grid gap-1.5 pl-4">
          {error.details.map((detail) => (
            <li key={detail} className="list-disc">
              {detail}
            </li>
          ))}
        </ul>
      ) : null}

      {error.actionHref && error.actionLabel ? (
        <Link
          href={error.actionHref}
          className="mt-4 inline-flex rounded-full bg-red-700 px-4 py-2 text-xs font-black text-white transition hover:bg-red-800"
        >
          {error.actionLabel}
        </Link>
      ) : null}
    </div>
  )
}

function PickupPointCard({
  point,
  selected,
  onSelect,
}: {
  point: PickupPoint
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-4 text-left shadow-sm transition ${selected
          ? 'border-[#b5006e] bg-[#fceef6] ring-4 ring-[#fceef6]'
          : 'border-[#eee2e7] bg-[#faf7f8] hover:border-[#b5006e] hover:bg-white'
        }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-black text-[#181014]">
            {point.label}
          </span>
          <span className="mt-1 block text-sm text-[#7a6d73]">
            {point.schedule}
          </span>
        </span>

        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${selected
              ? 'bg-[#b5006e] text-white'
              : 'border border-[#e8e1e4] bg-white text-transparent'
            }`}
        >
          ✓
        </span>
      </span>
    </button>
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
  hint,
  className,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ''}`}>
      <label htmlFor={htmlFor} className="text-sm font-bold text-[#181014]">
        {label}
      </label>

      {hint ? <p className="text-xs text-[#7a6d73]">{hint}</p> : null}

      {children}
    </div>
  )
}
