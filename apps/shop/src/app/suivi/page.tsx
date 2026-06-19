import { getCommandeTracking, type CommandeTrackingSummary } from '@/lib/api'
import { formatCurrencyFromCents } from '@/lib/money'
import Link from 'next/link'

type SuiviPageProps = {
  searchParams?: Promise<{
    token?: string | string[]
  }>
}

type SuiviPageState =
  | {
      kind: 'found'
      summary: CommandeTrackingSummary
    }
  | {
      kind: 'missing-token' | 'not-found' | 'api-error'
    }

export const dynamic = 'force-dynamic'

export default async function SuiviPage({ searchParams }: SuiviPageProps) {
  const params = searchParams ? await searchParams : {}
  const token = Array.isArray(params.token) ? params.token[0] : params.token
  const state = await getSuiviPageState(token)

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffafb_0%,#faf7f8_42%,#f7edf2_100%)] px-4 py-6 sm:py-10">
      <div className="mx-auto grid max-w-6xl gap-6">
        {state.kind === 'found' ? (
          <TrackedOrder summary={state.summary} />
        ) : (
          <TrackingFallback kind={state.kind} />
        )}
      </div>
    </main>
  )
}

async function getSuiviPageState(
  token: string | undefined,
): Promise<SuiviPageState> {
  if (!token?.trim()) {
    return { kind: 'missing-token' }
  }

  try {
    const summary = await getCommandeTracking(token)

    return summary ? { kind: 'found', summary } : { kind: 'not-found' }
  } catch {
    return { kind: 'api-error' }
  }
}

function TrackedOrder({ summary }: { summary: CommandeTrackingSummary }) {
  const paymentStatus = getPaymentStatus(summary.paiementStatut)
  const orderStatus = getOrderStatus(summary.statut)

  return (
    <>
      <section className="overflow-hidden rounded-[1.75rem] border border-[#f0dbe6] bg-white shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_360px] lg:items-stretch">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b5006e]">
              Suivi public
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-[#181014] sm:text-5xl">
              Commande {summary.reference}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#7a6d73] sm:text-base sm:leading-7">
              Retrouvez ici les informations utiles pour votre retrait Click &
              Collect. Ce lien ne donne pas accès à un espace client.
            </p>
          </div>

          <div className="rounded-[1.5rem] bg-[#fceef6] p-5">
            <p className="text-sm font-black uppercase tracking-wide text-[#8c0055]">
              État de la commande
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <SummaryRow label="Statut" value={orderStatus.label} />
              <SummaryRow label="Paiement" value={paymentStatus.label} />
              <SummaryRow
                label="Total TTC"
                value={formatCurrency(summary.totalTtcCents)}
              />
            </dl>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <section className="rounded-[1.75rem] border border-[#eee2e7] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-[#b5006e]">
                Détails
              </p>
              <h2 className="text-2xl font-black text-[#181014]">
                Produits commandés
              </h2>
            </div>
            <p className="text-sm font-bold text-[#7a6d73]">
              {summary.lignes.length} ligne
              {summary.lignes.length > 1 ? 's' : ''}
            </p>
          </div>

          {summary.lignes.length > 0 ? (
            <ul className="mt-5 grid gap-3">
              {summary.lignes.map((line) => (
                <li
                  key={`${line.nom}-${line.quantite}-${line.prixUnitCents}`}
                  className="grid gap-3 rounded-2xl border border-[#eee2e7] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-black text-[#181014]">{line.nom}</p>
                    <p className="mt-1 text-sm text-[#7a6d73]">
                      {line.quantite} x {formatCurrency(line.prixUnitCents)}
                    </p>
                  </div>
                  <p className="font-black text-[#b5006e]">
                    {formatCurrency(line.totalCents)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl bg-[#faf7f8] p-4 text-sm leading-6 text-[#7a6d73]">
              Le détail des produits n’est pas disponible pour le moment.
            </p>
          )}
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.75rem] border border-[#eee2e7] bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-[#b5006e]">
              Retrait
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#181014]">
              Click & Collect
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <SummaryRow label="Lieu" value={summary.lieu} />
              <SummaryRow
                label="Date"
                value={
                  summary.dateRetrait
                    ? formatDate(summary.dateRetrait)
                    : 'Date à confirmer'
                }
              />
            </dl>
          </section>

          <section className="rounded-[1.75rem] border border-[#eee2e7] bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-[#b5006e]">
              Besoin d’aide ?
            </p>
            <p className="mt-3 text-sm leading-6 text-[#7a6d73]">
              Si une information vous semble incorrecte, contactez la boutique
              avec la référence {summary.reference}.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex rounded-full bg-[#b5006e] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#8c0055]"
            >
              Retour à la boutique
            </Link>
          </section>
        </aside>
      </div>
    </>
  )
}

function TrackingFallback({
  kind,
}: {
  kind: Exclude<SuiviPageState['kind'], 'found'>
}) {
  const content = getFallbackContent(kind)

  return (
    <section className="mx-auto grid min-h-[70vh] w-full max-w-2xl place-items-center text-center">
      <div className="rounded-[1.75rem] border border-[#eee2e7] bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b5006e]">
          {content.eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-[#181014]">
          {content.title}
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#7a6d73]">
          {content.message}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-[#b5006e] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#8c0055]"
        >
          Retour à la boutique
        </Link>
      </div>
    </section>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#eee2e7] pb-2 last:border-b-0 last:pb-0">
      <dt className="text-[#7a6d73]">{label}</dt>
      <dd className="text-right font-black text-[#181014]">{value}</dd>
    </div>
  )
}

function getPaymentStatus(status: CommandeTrackingSummary['paiementStatut']) {
  const labels: Record<
    CommandeTrackingSummary['paiementStatut'],
    { label: string }
  > = {
    confirme: { label: 'Confirmé' },
    en_attente: { label: 'En cours' },
    a_verifier: { label: 'À vérifier' },
    annule: { label: 'Annulé' },
  }

  return labels[status]
}

function getOrderStatus(status: string) {
  const labels: Record<string, { label: string }> = {
    paiement_en_attente: { label: 'Paiement en attente' },
    paiement_a_verifier: { label: 'Paiement à vérifier' },
    nouvelle: { label: 'En préparation' },
    preparee: { label: 'Prête au retrait' },
    traitee: { label: 'Retirée' },
    annulee: { label: 'Annulée' },
  }

  return labels[status] ?? { label: 'En cours' }
}

function getFallbackContent(kind: Exclude<SuiviPageState['kind'], 'found'>) {
  if (kind === 'missing-token') {
    return {
      eyebrow: 'Lien manquant',
      title: 'Aucune commande à afficher',
      message:
        'Ouvrez le lien de suivi reçu après votre paiement pour consulter votre commande.',
    }
  }

  if (kind === 'api-error') {
    return {
      eyebrow: 'Suivi indisponible',
      title: 'Impossible de charger le suivi',
      message:
        'Le suivi est temporairement indisponible. Réessayez dans quelques instants.',
    }
  }

  return {
    eyebrow: 'Commande introuvable',
    title: 'Lien de suivi invalide',
    message: 'Commande introuvable ou lien de suivi invalide.',
  }
}

function formatCurrency(value: number) {
  return formatCurrencyFromCents(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}
