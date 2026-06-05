import Link from 'next/link'
import {
  getCheckoutSummary,
  type CheckoutSummary,
} from '@/lib/api'

type SuccessPageProps = {
  searchParams?: Promise<{
    session_id?: string | string[]
  }>
}

type SuccessPageState =
  | {
      kind: 'confirmed'
      summary: CheckoutSummary
    }
  | {
      kind: 'missing-session' | 'not-found' | 'api-error'
    }

export const dynamic = 'force-dynamic'

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = searchParams ? await searchParams : {}
  const sessionId = Array.isArray(params.session_id)
    ? params.session_id[0]
    : params.session_id

  const state = await getSuccessPageState(sessionId)

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fffafb_0%,#faf7f8_42%,#f7edf2_100%)] px-4 py-6 sm:py-10">
      <div className="mx-auto grid max-w-6xl gap-6">
        {state.kind === 'confirmed' ? (
          <ConfirmedOrder summary={state.summary} />
        ) : (
          <FallbackConfirmation kind={state.kind} />
        )}
      </div>
    </main>
  )
}

async function getSuccessPageState(
  sessionId: string | undefined,
): Promise<SuccessPageState> {
  if (!sessionId) {
    return { kind: 'missing-session' }
  }

  try {
    const summary = await getCheckoutSummary(sessionId)

    return summary ? { kind: 'confirmed', summary } : { kind: 'not-found' }
  } catch {
    return { kind: 'api-error' }
  }
}

function ConfirmedOrder({ summary }: { summary: CheckoutSummary }) {
  const paymentStatus = getPaymentStatus(summary.paiementStatut)
  const orderStatus = getOrderStatus(summary.statut)
  const isPaymentConfirmed = summary.paiementStatut === 'confirme'

  return (
    <>
      <section className="overflow-hidden rounded-[1.75rem] border border-[#f0dbe6] bg-white shadow-sm">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_360px] lg:items-stretch">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-[#b5006e]">
              Paiement {paymentStatus.label.toLowerCase()}
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-[#181014] sm:text-5xl">
              {isPaymentConfirmed
                ? 'Commande confirmée'
                : 'Commande bien reçue'}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#7a6d73] sm:text-base sm:leading-7">
              Merci pour votre commande. Nous préparons votre retrait Click &
              Collect avec les informations renseignées au paiement.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-full bg-[#b5006e] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#8c0055]"
              >
                Retour à la boutique
              </Link>
              <Link
                href="/click-and-collect"
                className="rounded-full border border-[#e8e1e4] bg-white px-5 py-3 text-sm font-black text-[#5a0037] transition hover:border-[#b5006e]"
              >
                Infos retrait
              </Link>
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-[#fceef6] p-5">
            <p className="text-sm font-black uppercase tracking-wide text-[#8c0055]">
              Récapitulatif
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <SummaryRow label="Commande" value={summary.reference} />
              <SummaryRow label="Total TTC" value={formatCurrency(summary.totalTTC)} />
              <SummaryRow label="Paiement" value={paymentStatus.label} />
              <SummaryRow label="Statut" value={orderStatus.label} />
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
                  key={`${line.nom}-${line.quantite}-${line.prixUnit}`}
                  className="grid gap-3 rounded-2xl border border-[#eee2e7] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-black text-[#181014]">{line.nom}</p>
                    <p className="mt-1 text-sm text-[#7a6d73]">
                      {line.quantite} x {formatCurrency(line.prixUnit)}
                    </p>
                  </div>
                  <p className="font-black text-[#b5006e]">
                    {formatCurrency(line.total)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl bg-[#faf7f8] p-4 text-sm leading-6 text-[#7a6d73]">
              Le détail des produits n’est pas disponible, mais votre paiement a
              bien été pris en compte.
            </p>
          )}
        </section>

        <aside className="grid gap-6">
          <section className="rounded-[1.75rem] border border-[#eee2e7] bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-[#b5006e]">
              Click & Collect
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#181014]">
              Votre retrait
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

            <div className="mt-5 rounded-2xl bg-[#faf7f8] p-4 text-sm leading-6 text-[#4a3d43]">
              Présentez-vous au point de retrait choisi avec votre nom de
              commande. Les commandes sont uniquement disponibles en Click &
              Collect : aucune livraison à domicile n’est proposée.
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[#eee2e7] bg-white p-5 shadow-sm">
            <p className="text-sm font-black uppercase tracking-wide text-[#b5006e]">
              Prochaines étapes
            </p>
            <ol className="mt-4 grid gap-3">
              <StepItem title="Confirmation" text={getEmailStepText(summary)} />
              <StepItem
                title="Préparation"
                text="La boutique prépare les produits sélectionnés pour le créneau prévu."
              />
              <StepItem
                title="Retrait"
                text="Récupérez votre commande au lieu choisi, sans livraison à domicile."
              />
            </ol>
          </section>
        </aside>
      </div>
    </>
  )
}

function FallbackConfirmation({
  kind,
}: {
  kind: Exclude<SuccessPageState['kind'], 'confirmed'>
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

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-full bg-[#b5006e] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#8c0055]"
          >
            Retour à la boutique
          </Link>
          <Link
            href="/checkout"
            className="rounded-full border border-[#e8e1e4] bg-white px-5 py-3 text-sm font-black text-[#5a0037] transition hover:border-[#b5006e]"
          >
            Retour au paiement
          </Link>
        </div>
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

function StepItem({ title, text }: { title: string; text: string }) {
  return (
    <li className="rounded-2xl bg-[#faf7f8] p-4">
      <p className="font-black text-[#181014]">{title}</p>
      <p className="mt-1 text-sm leading-6 text-[#7a6d73]">{text}</p>
    </li>
  )
}

function getPaymentStatus(status: CheckoutSummary['paiementStatut']) {
  const labels: Record<CheckoutSummary['paiementStatut'], { label: string }> = {
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

function getEmailStepText(summary: CheckoutSummary) {
  if (summary.paiementStatut === 'confirme') {
    return 'Un email de confirmation est envoyé à l’adresse renseignée lors du paiement.'
  }

  return 'La confirmation finale sera envoyée dès que le paiement sera validé.'
}

function getFallbackContent(kind: Exclude<SuccessPageState['kind'], 'confirmed'>) {
  if (kind === 'not-found') {
    return {
      eyebrow: 'Commande introuvable',
      title: 'Impossible de retrouver cette commande',
      message:
        'Le lien de confirmation ne correspond à aucune commande connue. Si le paiement vient d’être validé, patientez quelques instants puis revenez depuis l’email de confirmation.',
    }
  }

  if (kind === 'api-error') {
    return {
      eyebrow: 'Détails indisponibles',
      title: 'Votre confirmation est en cours',
      message:
        'Nous ne pouvons pas afficher le récapitulatif pour le moment. Si le paiement a été validé, la boutique reçoit tout de même la commande et la confirmation suit par email.',
    }
  }

  return {
    eyebrow: 'Confirmation',
    title: 'Aucune commande à afficher',
    message:
      'Cette page s’ouvre normalement après un paiement validé. Pour finaliser une commande, retournez au panier puis relancez le paiement.',
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value))
}
