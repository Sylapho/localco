import CommandeStatusBadge from '@/components/commandes/commande-status-badge'
import PreparationStatusActions from '@/components/commandes/preparation-status-actions'
import PrintButton from '@/components/layout/print-button'
import { getCommandes } from '@/lib/api'
import {
  aggregatePreparationLines,
  getPreparationCommandes,
  getPreparationDateOptions,
  getPreparationPickupPoints,
  groupPreparationCommandes,
  resolvePreparationDateSelection,
  type PreparationLine,
} from '@/lib/preparation'
import Link from 'next/link'

type PreparationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key]

  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function formatDateKey(dateKey: string) {
  if (dateKey === 'unknown') {
    return 'Date de retrait non précisée'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeZone: 'Europe/Paris',
  }).format(new Date(`${dateKey}T12:00:00.000Z`))
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Non précisée'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  }).format(value)
}

function getDateHref(date: string, pickupPoint: string) {
  const params = new URLSearchParams()

  params.set('date', date)

  if (pickupPoint) {
    params.set('lieu', pickupPoint)
  }

  return `/preparation?${params.toString()}`
}

function PreparationLines({ lines }: { lines: PreparationLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-gray-600">Aucun produit à préparer.</p>
  }

  return (
    <ul className="grid gap-2">
      {lines.map((line) => (
        <li
          key={line.articleId}
          className="flex items-start justify-between gap-3 rounded border bg-white px-3 py-2 print:border-0 print:px-0"
        >
          <span className="font-medium">{line.articleNom}</span>
          <span className="shrink-0 font-bold">
            {formatQuantity(line.quantity)} x
          </span>
        </li>
      ))}
    </ul>
  )
}

export default async function PreparationPage({
  searchParams,
}: PreparationPageProps) {
  const params = (await searchParams) ?? {}
  const dateParam = getParam(params, 'date')
  const selectedPickupPoint = getParam(params, 'lieu')
  const dateOptions = getPreparationDateOptions()
  const selectedDate = resolvePreparationDateSelection(dateParam)
  const commandes = await getCommandes()
  const dateCommandes = getPreparationCommandes(commandes, {
    dateKey: selectedDate.dateKey,
  })
  const pickupPoints = getPreparationPickupPoints(dateCommandes)
  const filteredCommandes = getPreparationCommandes(commandes, {
    dateKey: selectedDate.dateKey,
    pickupPoint: selectedPickupPoint,
  })
  const groups = groupPreparationCommandes(filteredCommandes)
  const summaryLines = aggregatePreparationLines(filteredCommandes)
  const totalQuantity = summaryLines.reduce(
    (total, line) => total + line.quantity,
    0,
  )

  return (
    <main className="preparation-print-page p-6 print:bg-white print:p-0 sm:p-8">
      <div className="mx-auto grid max-w-7xl gap-6 print:max-w-none">
        <section className="rounded border bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500 print:hidden">
                Back-office
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Préparation du jour
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">
                Commandes à préparer, regroupées par date de retrait et point de
                retrait.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 print:hidden">
              <PrintButton className="rounded border px-4 py-2 text-sm font-medium">
                Imprimer
              </PrintButton>
              <Link
                href="/commandes"
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Toutes les commandes
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 print:hidden sm:grid-cols-3">
          {Object.values(dateOptions).map((option) => (
            <Link
              key={option.value}
              href={getDateHref(option.value, selectedPickupPoint)}
              className={`rounded border bg-white p-4 shadow-sm ${
                selectedDate.value === option.value
                  ? 'border-black'
                  : 'border-gray-200'
              }`}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-sm text-gray-600">
                {option.dateKey ? formatDateKey(option.dateKey) : 'Vue globale'}
              </span>
            </Link>
          ))}
        </section>

        <form className="grid gap-4 rounded border bg-white p-4 shadow-sm print:hidden md:grid-cols-[1fr_1fr_auto_auto]">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Date</span>
            <select
              name="date"
              defaultValue={selectedDate.value}
              className="rounded border px-3 py-2"
            >
              {Object.values(dateOptions).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Point de retrait</span>
            <select
              name="lieu"
              defaultValue={selectedPickupPoint}
              className="rounded border px-3 py-2"
            >
              <option value="">Tous les points</option>
              {pickupPoints.map((pickupPoint) => (
                <option key={pickupPoint} value={pickupPoint}>
                  {pickupPoint}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="self-end rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Filtrer
          </button>

          <Link
            href="/preparation"
            className="self-end rounded border px-4 py-2 text-center text-sm font-medium"
          >
            Réinitialiser
          </Link>
        </form>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border bg-white p-4 shadow-sm print:border print:shadow-none">
            <p className="text-sm text-gray-600">Commandes</p>
            <p className="mt-2 text-2xl font-bold">
              {filteredCommandes.length}
            </p>
          </div>

          <div className="rounded border bg-white p-4 shadow-sm print:border print:shadow-none">
            <p className="text-sm text-gray-600">Produits distincts</p>
            <p className="mt-2 text-2xl font-bold">{summaryLines.length}</p>
          </div>

          <div className="rounded border bg-white p-4 shadow-sm print:border print:shadow-none">
            <p className="text-sm text-gray-600">Quantité totale</p>
            <p className="mt-2 text-2xl font-bold">
              {formatQuantity(totalQuantity)}
            </p>
          </div>

          <div className="rounded border bg-white p-4 shadow-sm print:border print:shadow-none">
            <p className="text-sm text-gray-600">Points de retrait</p>
            <p className="mt-2 text-2xl font-bold">
              {new Set(filteredCommandes.map((commande) => commande.lieu)).size}
            </p>
          </div>
        </section>

        {filteredCommandes.length === 0 ? (
          <section className="rounded border bg-white p-6 text-center shadow-sm print:border print:shadow-none">
            <h2 className="text-lg font-semibold">Rien à préparer</h2>
            <p className="mt-2 text-sm text-gray-600">
              Aucune commande nouvelle ou préparée ne correspond aux filtres.
            </p>
          </section>
        ) : null}

        {groups.map((dateGroup) => (
          <section
            key={dateGroup.dateKey}
            className="grid gap-4 rounded border bg-white p-5 shadow-sm print:break-inside-avoid print:border print:p-4 print:shadow-none"
          >
            <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4 print:border-black">
              <div>
                <h2 className="text-xl font-bold">
                  {formatDateKey(dateGroup.dateKey)}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {dateGroup.commandes.length} commande(s),{' '}
                  {formatQuantity(dateGroup.totalQuantity)} produit(s)
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded bg-gray-50 p-4 print:bg-white print:p-0">
              <h3 className="font-semibold">Total à préparer</h3>
              <PreparationLines lines={dateGroup.lines} />
            </div>

            <div className="grid gap-5">
              {dateGroup.pickupGroups.map((pickupGroup) => (
                <section
                  key={`${dateGroup.dateKey}-${pickupGroup.pickupPoint}`}
                  className="grid gap-4 rounded border p-4 print:break-inside-avoid print:border-black"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {pickupGroup.pickupPoint}
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {pickupGroup.commandes.length} commande(s),{' '}
                        {formatQuantity(pickupGroup.totalQuantity)} produit(s)
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                    <div className="grid content-start gap-3 rounded bg-gray-50 p-4 print:bg-white print:p-0">
                      <h4 className="font-semibold">À préparer ici</h4>
                      <PreparationLines lines={pickupGroup.lines} />
                    </div>

                    <div className="grid gap-3">
                      {pickupGroup.commandes.map((commande) => (
                        <details
                          key={commande.id}
                          className="rounded border bg-white p-3 print:break-inside-avoid print:border-black"
                        >
                          <summary className="cursor-pointer list-none">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <span className="font-semibold">
                                  #{commande.id} - {commande.nom}
                                </span>
                                <p className="mt-1 text-sm text-gray-600">
                                  Retrait : {formatDateTime(commande.dateRetrait)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <CommandeStatusBadge statut={commande.statut} />
                              </div>
                            </div>
                          </summary>

                          <div className="mt-4 grid gap-4">
                            <div className="grid gap-1 text-sm text-gray-700">
                              <p>{commande.email}</p>
                              {commande.tel ? <p>{commande.tel}</p> : null}
                            </div>

                            <ul className="grid gap-2">
                              {commande.lignes.map((ligne) => (
                                <li
                                  key={ligne.id}
                                  className="flex justify-between gap-3 rounded bg-gray-50 px-3 py-2 text-sm print:bg-white print:px-0"
                                >
                                  <span>{ligne.article.nom}</span>
                                  <span className="font-semibold">
                                    {formatQuantity(ligne.quantite)} x
                                  </span>
                                </li>
                              ))}
                            </ul>

                            <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                              <Link
                                href={`/commandes/${commande.id}`}
                                className="text-sm font-medium text-gray-700 underline"
                              >
                                Ouvrir la commande
                              </Link>

                              <PreparationStatusActions
                                commandeId={commande.id}
                                statut={commande.statut}
                              />
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
