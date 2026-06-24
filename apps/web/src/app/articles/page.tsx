import Link from 'next/link'
import ArticleImage from '@/components/articles/article-image'
import {
  ButtonLink,
  EmptyState,
  Page,
  PageHeader,
  SectionCard,
  StatCard,
} from '@/components/ui/dashboard'
import { getArticles } from '@/lib/api'
import { getArticleCategoryLabel } from '@/lib/article-categories'
import { requireUiPermission } from '@/lib/auth-session'
import { formatCurrencyFromCents } from '@/lib/money'
import { canManageArticles, canViewArticles } from '@/lib/permissions'

function stockTone(stock: number) {
  if (stock <= 0) return 'danger'
  if (stock <= 3) return 'warning'
  return 'success'
}

function stockLabel(stock: number) {
  if (stock <= 0) return 'Rupture'
  if (stock <= 3) return 'Bas'
  return 'OK'
}

export default async function ArticlesPage() {
  const session = await requireUiPermission(canViewArticles)
  const userCanManageArticles = canManageArticles(session.user)
  const articles = await getArticles()
  const onlineArticles = articles.filter((article) => article.online)
  const lowStockArticles = articles.filter((article) => article.stock <= 3)
  const averagePrice = articles.length
    ? Math.round(
        articles.reduce((total, article) => total + article.prixCents, 0) /
          articles.length,
      )
    : 0

  return (
    <Page>
      <PageHeader
        eyebrow="Catalogue"
        title="Articles"
        description="Pilotez les produits vendus en boutique : prix, catégorie, visibilité en ligne et disponibilité."
        actions={
          userCanManageArticles ? (
            <ButtonLink href="/articles/new" variant="primary">
              Nouvel article
            </ButtonLink>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Articles"
          value={articles.length}
          detail="Références au catalogue"
        />
        <StatCard
          label="En ligne"
          value={onlineArticles.length}
          detail="Visibles côté boutique"
          tone="success"
        />
        <StatCard
          label="Stock bas"
          value={lowStockArticles.length}
          detail="À produire ou réapprovisionner"
          tone={lowStockArticles.length > 0 ? 'warning' : 'success'}
        />
      </section>

      <SectionCard
        className="mt-6"
        title="Catalogue produits"
        description={
          articles.length > 0
            ? `Prix moyen : ${formatCurrencyFromCents(averagePrice)}.`
            : 'Les articles créés apparaîtront ici.'
        }
      >
        {articles.length === 0 ? (
          <EmptyState
            title="Aucun article disponible"
            description="Créez un premier article pour alimenter le catalogue de la boutique et commencer à suivre le stock."
            action={
              userCanManageArticles ? (
                <ButtonLink href="/articles/new" variant="primary">
                  Créer un article
                </ButtonLink>
              ) : null
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => {
              const tone = stockTone(article.stock)

              return (
                <li
                  key={article.id}
                  className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm transition hover:border-[var(--primary)]"
                >
                  <div className="flex items-start gap-3">
                    <ArticleImage
                      article={article}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-bold">
                          {article.nom}
                        </h2>
                        <span
                          className={
                            article.online
                              ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700'
                              : 'rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600'
                          }
                        >
                          {article.online ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {getArticleCategoryLabel(article.category)}
                      </p>
                    </div>
                  </div>

                  {article.description ? (
                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                      {article.description}
                    </p>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                      Aucune description renseignée.
                    </p>
                  )}

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-[var(--surface-soft)] p-3">
                      <dt className="text-[var(--muted)]">Prix TTC</dt>
                      <dd className="mt-1 font-bold">
                        {formatCurrencyFromCents(article.prixCents)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-soft)] p-3">
                      <dt className="text-[var(--muted)]">Stock</dt>
                      <dd className="mt-1 flex items-center gap-2 font-bold">
                        {article.stock}
                        <span
                          className={
                            tone === 'danger'
                              ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700'
                              : tone === 'warning'
                                ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800'
                                : 'rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700'
                          }
                        >
                          {stockLabel(article.stock)}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/articles/${article.id}`}
                      className="lc-button lc-button-secondary"
                    >
                      Voir
                    </Link>

                    {userCanManageArticles ? (
                      <Link
                        href={`/articles/${article.id}/edit`}
                        className="lc-button lc-button-ghost"
                      >
                        Modifier
                      </Link>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </Page>
  )
}