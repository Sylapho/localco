import Link from 'next/link'
import {
  getArticles,
  getCaisseToday,
  getCommandes,
  getMatieresPremieres,
  getStockLots,
  type Article,
  type MatierePremiere,
} from '@/lib/api'
import { requireUiPermission } from '@/lib/auth-session'
import {
  canCreateSales,
  canViewArticles,
  canViewCashRegister,
  canViewOrders,
  canViewStock,
} from '@/lib/permissions'
import { getProductionNeeds } from '@/lib/production-needs'

const quickLinks = [
  {
    label: 'Caisse',
    href: '/caisse',
    description: 'Suivre la journée et clôturer la caisse.',
    section: 'cash',
  },
  {
    label: 'Articles',
    href: '/articles',
    description: 'Gérer le catalogue, les prix et les stocks.',
    section: 'articles',
  },
  {
    label: 'Stock',
    href: '/stock',
    description: 'Contrôler les lots, DLC et alertes.',
    section: 'stock',
  },
  {
    label: 'Commandes',
    href: '/commandes',
    description: 'Préparer les commandes en ligne.',
    section: 'orders',
  },
] as const

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100)
}

function formatDate(value: string | Date) {
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

function getLowStockItems(
  articles: Article[],
  matieres: MatierePremiere[],
) {
  const lowArticles = articles
    .filter((article) => article.stock <= 5)
    .map((article) => ({
      id: `article-${article.id}`,
      name: article.nom,
      detail: `${article.stock} en stock`,
      href: `/articles/${article.id}`,
    }))

  const lowMatieres = matieres
    .filter((matiere) => matiere.stock <= matiere.seuil)
    .map((matiere) => ({
      id: `matiere-${matiere.id}`,
      name: matiere.nom,
      detail: `${matiere.stock} ${matiere.unite} / seuil ${matiere.seuil}`,
      href: `/matieres-premieres/${matiere.id}`,
    }))

  return [...lowMatieres, ...lowArticles].slice(0, 5)
}

export default async function Home() {
  const session = await requireUiPermission(() => true)
  const userCanCreateSales = canCreateSales(session.user)
  const userCanViewArticles = canViewArticles(session.user)
  const userCanViewCashRegister = canViewCashRegister(session.user)
  const userCanViewOrders = canViewOrders(session.user)
  const userCanViewStock = canViewStock(session.user)
  const [caisse, commandes, articles, matieres, lots] = await Promise.all([
    userCanViewCashRegister ? getCaisseToday() : Promise.resolve(null),
    userCanViewOrders ? getCommandes() : Promise.resolve([]),
    userCanViewArticles ? getArticles() : Promise.resolve([]),
    userCanViewStock ? getMatieresPremieres() : Promise.resolve([]),
    userCanViewStock ? getStockLots() : Promise.resolve([]),
  ])
  const visibleQuickLinks = quickLinks.filter((link) => {
    if (link.section === 'cash') return userCanViewCashRegister
    if (link.section === 'articles') return userCanViewArticles
    if (link.section === 'stock') return userCanViewStock
    return userCanViewOrders
  })

  const commandesAPreparer = commandes.filter(
    (commande) =>
      commande.statut === 'nouvelle' || commande.statut === 'preparee',
  )
  const productionNeeds = getProductionNeeds(commandes)
  const totalProductionNeeds = productionNeeds.reduce(
    (total, need) => total + need.quantityToProduce,
    0,
  )
  const lowStockItems = getLowStockItems(articles, matieres)
  const now = new Date()
  const nearLimit = new Date(now)
  nearLimit.setDate(nearLimit.getDate() + 3)
  const expiringLots = lots
    .filter((lot) => {
      if (!lot.expiresAt || lot.remainingQuantity <= 0) {
        return false
      }

      const expiresAt = new Date(lot.expiresAt)

      return expiresAt <= nearLimit
    })
    .sort(
      (a, b) =>
        new Date(a.expiresAt ?? 0).getTime() -
        new Date(b.expiresAt ?? 0).getTime(),
    )
    .slice(0, 5)

  return (
    <main className="p-6 sm:p-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <section className="rounded border bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
                Espace employé
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Tableau de bord LocalCo
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-600 sm:text-base">
                Les indicateurs utiles pour démarrer la journée : caisse, stock
                et commandes à préparer.
              </p>
            </div>

            {userCanCreateSales ? (
              <Link
                href="/ventes/new"
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
              >
                Nouvelle vente
              </Link>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {caisse ? (
            <>
              <div className="rounded border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-600">Ventes du jour</p>
                <p className="mt-2 text-2xl font-bold">
                  {formatCurrency(caisse.totals.totalTtcCents)}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {caisse.totals.nbVentes} vente(s)
                </p>
              </div>

              <div className="rounded border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-600">État de caisse</p>
                <p className="mt-2 text-2xl font-bold">
                  {caisse.status === 'closed' ? 'Clôturée' : 'Ouverte'}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Journée du {formatDate(caisse.date)}
                </p>
              </div>
            </>
          ) : null}

          {userCanViewOrders ? (
            <>
              <div className="rounded border bg-white p-4 shadow-sm">
                <p className="text-sm text-gray-600">Commandes à préparer</p>
                <p className="mt-2 text-2xl font-bold">
                  {commandesAPreparer.length}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  Nouvelles ou en préparation
                </p>
              </div>

              <div className="rounded border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <p className="text-sm text-amber-800">À produire</p>
                <p className="mt-2 text-2xl font-bold text-amber-950">
                  {formatQuantity(totalProductionNeeds)}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Articles à faire ou ajuster
                </p>
              </div>
            </>
          ) : null}

          {userCanViewArticles || userCanViewStock ? (
            <div className="rounded border bg-white p-4 shadow-sm">
              <p className="text-sm text-gray-600">Alertes stock</p>
              <p className="mt-2 text-2xl font-bold">{lowStockItems.length}</p>
              <p className="mt-1 text-sm text-gray-600">
                Articles ou matières sous seuil
              </p>
            </div>
          ) : null}
        </section>

        {userCanViewOrders && productionNeeds.length > 0 ? (
          <section className="rounded border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-amber-950">
                  Production à prévoir
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  Quantités à faire ou ajuster pour honorer les prochaines dates de retrait.
                </p>
              </div>
              <Link href="/commandes" className="text-sm font-medium text-amber-900">
                Voir les commandes
              </Link>
            </div>

            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {productionNeeds.slice(0, 6).map((need) => (
                <li
                  key={`${need.articleId}-${need.dueDateKey}`}
                  className="rounded border border-amber-200 bg-white p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{need.articleNom}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        Pour le{' '}
                        {need.dueDate
                          ? formatDate(need.dueDate)
                          : 'Non précisée'}
                      </p>
                    </div>
                    <span className="rounded bg-amber-100 px-2 py-1 text-sm font-bold text-amber-950">
                      {formatQuantity(need.quantityToProduce)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {userCanViewOrders ? (
            <div className="rounded border bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Commandes prioritaires</h2>
              <Link href="/commandes" className="text-sm font-medium">
                Tout voir
              </Link>
            </div>

            {commandesAPreparer.length === 0 ? (
              <p className="text-sm text-gray-600">
                Aucune commande à préparer pour le moment.
              </p>
            ) : (
              <ul className="grid gap-3">
                {commandesAPreparer.slice(0, 5).map((commande) => (
                  <li
                    key={commande.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">Commande #{commande.id}</p>
                      <p className="text-sm text-gray-600">
                        {commande.nom} - {formatCurrency(commande.totalTtcCents)}
                      </p>
                    </div>
                    <Link
                      href={`/commandes/${commande.id}`}
                      className="rounded border px-3 py-2 text-sm"
                    >
                      Ouvrir
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            </div>
          ) : null}

          {userCanViewArticles || userCanViewStock ? (
            <div className="rounded border bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Stock à surveiller</h2>
              <Link href="/stock" className="text-sm font-medium">
                Voir le stock
              </Link>
            </div>

            {lowStockItems.length === 0 ? (
              <p className="text-sm text-gray-600">
                Aucun article ou ingrédient sous seuil.
              </p>
            ) : (
              <ul className="grid gap-3">
                {lowStockItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">{item.detail}</p>
                    </div>
                    <Link href={item.href} className="rounded border px-3 py-2 text-sm">
                      Voir
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded border bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Accès rapides</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {visibleQuickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded border p-4 transition hover:border-gray-400"
                >
                  <p className="font-semibold">{link.label}</p>
                  <p className="mt-2 text-sm text-gray-600">
                    {link.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {userCanViewStock ? (
            <aside className="rounded border bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Lots à contrôler</h2>
                <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium">
                  DLC
                </span>
              </div>

              {expiringLots.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Aucun lot proche de sa DLC.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {expiringLots.map((lot) => {
                    const name = lot.article?.nom ?? lot.mp?.nom ?? 'Lot'

                    return (
                      <li
                        key={lot.id}
                        className="border-b pb-3 last:border-b-0 last:pb-0"
                      >
                        <p className="font-medium">{name}</p>
                        <p className="text-sm text-gray-600">
                          {lot.remainingQuantity} restant(s) - DLC{' '}
                          {formatDate(lot.expiresAt ?? lot.createdAt)}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </aside>
          ) : null}
        </section>
      </div>
    </main>
  )
}
