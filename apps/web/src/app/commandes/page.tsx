import CommandeStatusActions from '@/components/commandes/commande-status-actions'
import CommandeStatusBadge from '@/components/commandes/commande-status-badge'
import ArticleImage from '@/components/articles/article-image'
import { getCommandes } from '@/lib/api'
import {
  getProductionNeeds,
  getProductionNeedsByCommandeId,
} from '@/lib/production-needs'
import Link from 'next/link'

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

export default async function CommandesPage() {
  const commandes = await getCommandes()
  const commandesActives = commandes.filter(
    (commande) =>
      commande.statut === 'nouvelle' || commande.statut === 'preparee',
  )
  const productionNeeds = getProductionNeeds(commandes)
  const productionNeedsByCommandeId =
    getProductionNeedsByCommandeId(productionNeeds)
  const totalProductionNeeds = productionNeeds.reduce(
    (total, need) => total + need.quantity,
    0,
  )

  return (
    <main className="p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Commandes en ligne</h1>
          <p className="mt-1 text-sm text-gray-600">
            Commandes passées par les clients depuis la future boutique publique.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded border bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              À traiter
            </p>
            <p className="mt-1 text-2xl font-bold">{commandesActives.length}</p>
          </div>

          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              À produire
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-950">
              {formatQuantity(totalProductionNeeds)}
            </p>
          </div>
        </div>
      </div>

      {commandes.length === 0 ? (
        <section className="rounded border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Aucune commande</h2>
          <p className="mt-1 text-sm text-gray-600">
            Les commandes client apparaîtront ici quand la boutique publique
            sera branchée.
          </p>
        </section>
      ) : (
        <div className="grid gap-4">
          {productionNeeds.length > 0 ? (
            <section className="rounded border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-amber-950">
                    Production à prévoir
                  </h2>
                  <p className="mt-1 text-sm text-amber-800">
                    Les commandes peuvent dépasser le stock. Cette liste indique
                    quoi produire ou ajuster, et pour quelle date de retrait.
                  </p>
                </div>
                <Link
                  href="/stock#lot-article"
                  className="rounded border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900"
                >
                  Ajouter un lot
                </Link>
              </div>

              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {productionNeeds.map((need) => (
                  <li
                    key={`${need.articleId}-${need.dueDateKey}`}
                    className="rounded border border-amber-200 bg-white p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-950">
                          {need.articleNom}
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          Stock actuel : {formatQuantity(need.stock)}
                        </p>
                      </div>
                      <p className="rounded bg-amber-100 px-2 py-1 text-sm font-bold text-amber-950">
                        {formatQuantity(need.quantity)} à faire
                      </p>
                    </div>

                    <p className="mt-3 text-sm text-amber-900">
                      Pour le {formatDate(need.dueDate)}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      Commande(s) #{need.commandeIds.join(', #')}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="grid gap-4">
          {commandes.map((commande) => {
            const commandeProductionNeeds =
              productionNeedsByCommandeId.get(commande.id) ?? []

            return (
              <article
              key={commande.id}
              className="rounded border bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">
                      Commande #{commande.id}
                    </h2>
                    <CommandeStatusBadge statut={commande.statut} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatDateTime(commande.createdAt)}
                  </p>
                </div>

                <p className="text-xl font-bold">
                  {formatCurrency(commande.totalTtcCents)}
                </p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded bg-gray-50 p-3">
                  <h3 className="font-medium">Client</h3>
                  <dl className="mt-2 grid gap-1 text-sm text-gray-700">
                    <div className="flex justify-between gap-4">
                      <dt>Nom</dt>
                      <dd className="font-medium">{commande.nom}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Email</dt>
                      <dd className="font-medium">{commande.email}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Téléphone</dt>
                      <dd className="font-medium">{commande.tel || '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Retrait</dt>
                      <dd className="font-medium">{commande.lieu}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Date souhaitée</dt>
                      <dd className="font-medium">
                        {formatDate(commande.dateRetrait)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded bg-gray-50 p-3">
                  <h3 className="font-medium">Articles</h3>
                  <ul className="mt-2 grid gap-2 text-sm">
                    {commande.lignes.map((ligne) => (
                      <li
                        key={ligne.id}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="flex items-center gap-2">
                          <ArticleImage
                            article={ligne.article}
                            className="h-8 w-8 overflow-hidden rounded border bg-gray-100"
                          />
                          <span>
                            {ligne.article.nom} x{ligne.quantite}
                          </span>
                        </span>
                        <span className="font-medium">
                          {formatCurrency(ligne.prixUnitCents * ligne.quantite)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {commandeProductionNeeds.length > 0 ? (
                <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
                  <h3 className="font-medium text-amber-950">
                    À produire pour ce retrait
                  </h3>
                  <ul className="mt-2 grid gap-1 text-sm text-amber-900">
                    {commandeProductionNeeds.map((need) => (
                      <li
                        key={`${commande.id}-${need.articleId}-${need.dueDateKey}`}
                      >
                        {need.articleNom} : {formatQuantity(need.quantity)} à
                        faire pour le {formatDate(need.dueDate)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/commandes/${commande.id}`}
                    className="rounded border px-3 py-2 text-sm"
                  >
                    Voir détail
                  </Link>

                  <CommandeStatusActions
                    commandeId={commande.id}
                    statut={commande.statut}
                  />
                </div>
              </div>
              </article>
            )
          })}
          </section>
        </div>
      )}
    </main>
  )
}
