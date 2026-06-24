import ArticleImage from '@/components/articles/article-image'
import CommandeStatusActions from '@/components/commandes/commande-status-actions'
import CommandeStatusBadge, {
  commandeStatusLabels,
} from '@/components/commandes/commande-status-badge'
import { ButtonLink, Page, SectionCard } from '@/components/ui/dashboard'
import { getCommande } from '@/lib/api'
import { requireUiPermission } from '@/lib/auth-session'
import { canManageOrders, canViewOrders } from '@/lib/permissions'
import { notFound } from 'next/navigation'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'Non précisée'
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
  }).format(value)
}

export default async function CommandeDetailPage({ params }: PageProps) {
  const session = await requireUiPermission(canViewOrders)
  const userCanManageOrders = canManageOrders(session.user)
  const { id } = await params
  const commandeId = Number(id)

  if (!Number.isInteger(commandeId)) {
    notFound()
  }

  const commande = await getCommande(commandeId)
  const productionLines = commande.lignes.filter(
    (ligne) => (ligne.productionQuantity ?? 0) > 0,
  )

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ButtonLink href="/commandes" variant="secondary">
          Retour aux commandes
        </ButtonLink>
      </div>

      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">Commande #{commande.id}</h1>
              <CommandeStatusBadge statut={commande.statut} />
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Passée le {formatDateTime(commande.createdAt)}
            </p>
          </div>

          <p className="text-2xl font-bold">
            {formatCurrency(commande.totalTtcCents)}
          </p>
        </div>

        <div className="mt-6">
          <CommandeStatusActions
            commandeId={commande.id}
            statut={commande.statut}
            canManage={userCanManageOrders}
          />
        </div>
      </SectionCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard>
          <h2 className="text-lg font-semibold">Client</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b pb-2">
              <dt className="text-gray-600">Nom</dt>
              <dd className="font-medium">{commande.nom}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b pb-2">
              <dt className="text-gray-600">Email</dt>
              <dd className="font-medium">{commande.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Téléphone</dt>
              <dd className="font-medium">{commande.tel || '-'}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard>
          <h2 className="text-lg font-semibold">Retrait et paiement</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b pb-2">
              <dt className="text-gray-600">Lieu de retrait</dt>
              <dd className="font-medium">{commande.lieu}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b pb-2">
              <dt className="text-gray-600">Date souhaitée</dt>
              <dd className="font-medium">
                {formatDate(commande.dateRetrait)}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b pb-2">
              <dt className="text-gray-600">Paiement</dt>
              <dd className="font-medium">
                {commande.stripeId ? 'Stripe confirmé' : 'Non renseigné'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-600">Référence Stripe</dt>
              <dd className="max-w-[240px] truncate font-medium">
                {commande.stripeId || '-'}
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>

      <SectionCard className="mt-6">
        <h2 className="text-lg font-semibold">Articles</h2>

        <ul className="mt-4 divide-y">
          {commande.lignes.map((ligne) => (
            <li
              key={ligne.id}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="flex items-center gap-3">
                <ArticleImage
                  article={ligne.article}
                  className="h-14 w-14 overflow-hidden rounded border bg-gray-100"
                />
                <div>
                  <p className="font-medium">{ligne.article.nom}</p>
                  <p className="text-sm text-gray-600">
                    {ligne.quantite} x {formatCurrency(ligne.prixUnitCents)}
                  </p>
                </div>
              </div>

              <p className="font-semibold">
                {formatCurrency(ligne.prixUnitCents * ligne.quantite)}
              </p>

              {(ligne.productionQuantity ?? 0) > 0 ? (
                <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                  {formatQuantity(ligne.productionQuantity ?? 0)} à produire
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </SectionCard>

      {productionLines.length > 0 ? (
        <SectionCard className="mt-6 border-amber-200 bg-amber-50">
          <h2 className="text-lg font-semibold text-amber-950">
            Production requise
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Cette commande a été acceptée malgré un stock insuffisant. Les
            quantités ci-dessous sont à produire ou à ajuster avant retrait.
          </p>

          <ul className="mt-4 grid gap-2 text-sm text-amber-950">
            {productionLines.map((ligne) => (
              <li
                key={ligne.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-white px-3 py-2"
              >
                <span className="font-medium">{ligne.article.nom}</span>
                <span className="font-bold">
                  {formatQuantity(ligne.productionQuantity ?? 0)} à produire
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard className="mt-6">
        <h2 className="text-lg font-semibold">Historique des statuts</h2>

        {commande.historique && commande.historique.length > 0 ? (
          <ol className="mt-4 divide-y">
            {commande.historique.map((entry) => (
              <li key={entry.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {entry.ancienStatut
                        ? commandeStatusLabels[entry.ancienStatut]
                        : 'Création'}{' '}
                      {'->'} {commandeStatusLabels[entry.nouveauStatut]}
                    </p>
                    {entry.motif ? (
                      <p className="mt-1 text-sm text-gray-600">
                        Motif : {entry.motif}
                      </p>
                    ) : null}
                  </div>
                  <time className="text-sm text-gray-500">
                    {formatDateTime(entry.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            Aucun historique disponible pour cette commande.
          </p>
        )}
      </SectionCard>
    </Page>
  )
}
