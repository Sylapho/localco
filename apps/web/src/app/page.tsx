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
import {
  ButtonLink,
  EmptyState,
  Page,
  PageHeader,
  SectionCard,
  StatCard,
} from '@/components/ui/dashboard'

const quickLinks = [
  {
    label: 'Ouvrir la caisse',
    href: '/caisse',
    description: 'Suivre la journée, les paiements et la clôture.',
    section: 'cash',
  },
  {
    label: 'Gérer les articles',
    href: '/articles',
    description: 'Prix, stock, visibilité boutique et fiches produits.',
    section: 'articles',
  },
  {
    label: 'Contrôler le stock',
    href: '/stock',
    description: 'Lots, DLC, matières premières et réapprovisionnement.',
    section: 'stock',
  },
  {
    label: 'Préparer les commandes',
    href: '/commandes',
    description: 'Suivre les retraits clients et les statuts.',
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
      tone: article.stock <= 0 ? 'danger' : 'warning',
    }))

  const lowMatieres = matieres
    .filter((matiere) => matiere.stock <= matiere.seuil)
    .map((matiere) => ({
      id: `matiere-${matiere.id}`,
      name: matiere.nom,
      detail: `${matiere.stock} ${matiere.unite} / seuil ${matiere.seuil}`,
      href: `/matieres-premieres/${matiere.id}`,
      tone: 'danger',
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
    <Page>
      <PageHeader
        eyebrow="Pilotage quotidien"
        title="Tableau de bord Les cocottes de Diane"
        description="Les priorités de la journée au même endroit : commandes à préparer, production à prévoir, caisse et alertes stock."
        actions={
          userCanCreateSales ? (
            <ButtonLink href="/ventes/new" variant="primary">
              Nouvelle vente
            </ButtonLink>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {caisse ? (
          <>
            <StatCard
              label="Ventes du jour"
              value={formatCurrency(caisse.totals.totalTtcCents)}
              detail={`${caisse.totals.nbVentes} vente(s) enregistrée(s)`}
              tone="success"
            />
            <StatCard
              label="État de caisse"
              value={caisse.status === 'closed' ? 'Clôturée' : 'Ouverte'}
              detail={`Journée du ${formatDate(caisse.date)}`}
              tone={caisse.status === 'closed' ? 'neutral' : 'info'}
            />
          </>
        ) : null}

        {userCanViewOrders ? (
          <>
            <StatCard
              label="Commandes à préparer"
              value={commandesAPreparer.length}
              detail="Nouvelles ou déjà en préparation"
              tone="info"
            />
            <StatCard
              label="Unités à produire"
              value={formatQuantity(totalProductionNeeds)}
              detail="Besoin lié aux précommandes"
              tone={totalProductionNeeds > 0 ? 'warning' : 'success'}
            />
          </>
        ) : null}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          title="Raccourcis métier"
          description="Accédez vite aux écrans utilisés pendant une journée de vente."
        >
          {visibleQuickLinks.length === 0 ? (
            <EmptyState
              title="Aucun raccourci disponible"
              description="Ton rôle ne donne pas encore accès aux modules opérationnels."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleQuickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 transition hover:border-[var(--primary)] hover:bg-white"
                >
                  <p className="font-bold text-[var(--foreground)]">
                    {link.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {link.description}
                  </p>
                  <span className="mt-3 inline-flex text-sm font-bold text-[var(--primary)]">
                    Ouvrir
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Points d'attention"
          description="Ce qui peut demander une action avant la fin de journée."
          actions={
            userCanViewStock ? (
              <ButtonLink href="/stock" variant="ghost">
                Voir le stock
              </ButtonLink>
            ) : null
          }
        >
          {lowStockItems.length === 0 && expiringLots.length === 0 ? (
            <EmptyState
              title="Rien d'urgent à signaler"
              description="Aucun seuil critique ou lot proche de DLC n'a été détecté."
            />
          ) : (
            <div className="grid gap-3">
              {lowStockItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                >
                  <span>
                    <strong className="block">{item.name}</strong>
                    <span className="text-[var(--muted)]">{item.detail}</span>
                  </span>
                  <span
                    className={
                      item.tone === 'danger'
                        ? 'rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700'
                        : 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800'
                    }
                  >
                    Stock
                  </span>
                </Link>
              ))}

              {expiringLots.map((lot) => (
                <Link
                  key={`lot-${lot.id}`}
                  href="/stock"
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm"
                >
                  <span>
                    <strong className="block">
                      {lot.target === 'article'
                        ? (lot.article?.nom ?? `Article #${lot.articleId}`)
                        : (lot.mp?.nom ?? `Matière #${lot.mpId}`)}
                    </strong>
                    <span className="text-[var(--muted)]">
                      DLC {lot.expiresAt ? formatDate(lot.expiresAt) : 'non renseignée'}
                    </span>
                  </span>
                  <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800">
                    DLC
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </section>
    </Page>
  )
}