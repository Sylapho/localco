import Link from 'next/link'
import ArticleImage from '@/components/articles/article-image'
import CloseCaisseButton from '@/components/caisse/close-caisse-button'
import {
  ButtonLink,
  EmptyState,
  Page,
  PageHeader,
  SectionCard,
  StatCard,
} from '@/components/ui/dashboard'
import {
  getCaisseToday,
  getVentes,
  type Vente,
  type VenteMode,
} from '@/lib/api'
import { requireUiPermission } from '@/lib/auth-session'
import {
  canCreateSales,
  canManageCashRegister,
  canViewCashRegister,
} from '@/lib/permissions'

const modeLabels: Record<VenteMode, string> = {
  cb: 'Carte bancaire',
  especes: 'Espèces',
  cheque: 'Chèque',
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

function getDayKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(new Date(value))
}

function getTopArticles(ventes: Vente[]) {
  const articles = new Map<
    number,
    {
      nom: string
      imageUrl?: string | null
      quantite: number
      totalTtcCents: number
    }
  >()

  for (const vente of ventes) {
    for (const ligne of vente.lignes) {
      const current = articles.get(ligne.articleId) ?? {
        nom: ligne.article.nom,
        imageUrl: ligne.article.imageUrl,
        quantite: 0,
        totalTtcCents: 0,
      }

      articles.set(ligne.articleId, {
        ...current,
        quantite: current.quantite + ligne.quantite,
        totalTtcCents:
          current.totalTtcCents + ligne.prixUnitCents * ligne.quantite,
      })
    }
  }

  return Array.from(articles.values())
    .sort((a, b) => b.totalTtcCents - a.totalTtcCents)
    .slice(0, 5)
}

export default async function CaissePage() {
  const session = await requireUiPermission(canViewCashRegister)
  const userCanCreateSales = canCreateSales(session.user)
  const userCanCloseCashRegister = canManageCashRegister(session.user)
  const [caisse, ventes] = await Promise.all([getCaisseToday(), getVentes()])
  const ventesDuJour = ventes.filter(
    (vente) => getDayKey(vente.date) === caisse.dayKey,
  )
  const totalsByMode: Record<VenteMode, number> = {
    cb: caisse.totals.cbCents,
    especes: caisse.totals.especesCents,
    cheque: caisse.totals.chequesCents,
  }
  const topArticles = getTopArticles(ventesDuJour)

  const totalTTC = caisse.totals.totalTtcCents
  const totalHT = caisse.totals.totalHtCents
  const totalTVA = caisse.totals.tvaCents
  const totalRemise = ventesDuJour.reduce(
    (total, vente) => total + vente.remiseCents,
    0,
  )
  const nbArticles = ventesDuJour.reduce(
    (total, vente) =>
      total +
      vente.lignes.reduce((lineTotal, ligne) => lineTotal + ligne.quantite, 0),
    0,
  )
  const panierMoyen =
    caisse.totals.nbVentes > 0
      ? Math.round(totalTTC / caisse.totals.nbVentes)
      : 0

  return (
    <Page>
      <PageHeader
        eyebrow="Caisse"
        title="Caisse du jour"
        description={`Synthèse opérationnelle des ventes du ${caisse.dayKey}.`}
        actions={
          <>
            <ButtonLink href="/ventes" variant="secondary">
              Voir les ventes
            </ButtonLink>
            {userCanCreateSales ? (
              <ButtonLink href="/ventes/new" variant="primary">
                Nouvelle vente
              </ButtonLink>
            ) : null}
          </>
        }
      />

      <SectionCard className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="lc-eyebrow">État de caisse</p>
            {caisse.status === 'closed' ? (
              <p className="mt-2 text-xl font-bold">
                Journée clôturée
                {caisse.closedDay
                  ? ` le ${formatDateTime(caisse.closedDay.clotureeA)}`
                  : ''}
              </p>
            ) : (
              <p className="mt-2 text-xl font-bold text-[var(--success)]">
                Journée ouverte
              </p>
            )}
            <p className="mt-1 text-sm text-[var(--muted)]">
              La clôture fige les totaux de la journée pour le suivi comptable.
            </p>
          </div>

          <CloseCaisseButton
            disabled={caisse.status === 'closed'}
            canClose={userCanCloseCashRegister}
          />
        </div>
      </SectionCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total TTC" value={formatCurrency(totalTTC)} tone="success" />
        <StatCard
          label="Nombre de ventes"
          value={caisse.totals.nbVentes}
          detail="Tickets enregistrés"
        />
        <StatCard
          label="Panier moyen"
          value={formatCurrency(panierMoyen)}
          detail="TTC par vente"
          tone="info"
        />
        <StatCard
          label="Articles vendus"
          value={nbArticles}
          detail="Quantités sorties"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Encaissements" description="Répartition par mode de paiement.">
          <dl className="grid gap-3">
            {Object.entries(totalsByMode).map(([mode, total]) => (
              <div
                key={mode}
                className="flex justify-between gap-4 rounded-xl bg-[var(--surface-soft)] px-4 py-3"
              >
                <dt>{modeLabels[mode as VenteMode]}</dt>
                <dd className="font-bold">{formatCurrency(total)}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard title="Totaux comptables" description="Montants utiles à la clôture.">
          <dl className="grid gap-3">
            {[
              ['Total HT', totalHT],
              ['TVA', totalTVA],
              ['Remises', totalRemise],
              ['Marge estimée', caisse.totals.margeCents],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex justify-between gap-4 rounded-xl bg-[var(--surface-soft)] px-4 py-3"
              >
                <dt>{label}</dt>
                <dd className="font-bold">{formatCurrency(value as number)}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Top articles" description="Produits les plus vendus aujourd'hui.">
          {topArticles.length === 0 ? (
            <EmptyState
              title="Aucun article vendu aujourd'hui"
              description="Les meilleures ventes apparaîtront ici dès les premiers encaissements."
            />
          ) : (
            <ul className="grid gap-3">
              {topArticles.map((article) => (
                <li
                  key={article.nom}
                  className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-soft)] px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <ArticleImage
                      article={article}
                      className="h-10 w-10 overflow-hidden rounded-xl border border-[var(--border)] bg-white"
                    />
                    <span>
                      <span className="block font-bold">{article.nom}</span>
                      <span className="text-sm text-[var(--muted)]">
                        {article.quantite} vendu(s)
                      </span>
                    </span>
                  </div>
                  <p className="font-bold">{formatCurrency(article.totalTtcCents)}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Dernières ventes" description="Les derniers tickets de la journée.">
          {ventesDuJour.length === 0 ? (
            <EmptyState
              title="Aucune vente aujourd'hui"
              description="Enregistrez une vente pour alimenter la caisse et les statistiques du jour."
              action={
                userCanCreateSales ? (
                  <ButtonLink href="/ventes/new" variant="primary">
                    Enregistrer une vente
                  </ButtonLink>
                ) : null
              }
            />
          ) : (
            <ul className="grid gap-3">
              {ventesDuJour.slice(0, 6).map((vente) => (
                <li
                  key={vente.id}
                  className="flex items-center justify-between gap-4 rounded-xl bg-[var(--surface-soft)] px-4 py-3"
                >
                  <div>
                    <Link
                      href={`/ventes`}
                      className="font-bold text-[var(--foreground)]"
                    >
                      Vente #{vente.id}
                    </Link>
                    <p className="text-sm text-[var(--muted)]">
                      {formatDateTime(vente.date)} · {modeLabels[vente.mode]}
                    </p>
                  </div>
                  <p className="font-bold">{formatCurrency(vente.totalTtcCents)}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </section>
    </Page>
  )
}