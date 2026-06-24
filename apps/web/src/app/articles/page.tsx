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

      <section className="lc-stat-grid">
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
        className="lc-section-spaced"
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
          <ul className="lc-catalog-grid">
            {articles.map((article) => {
              const tone = stockTone(article.stock)

              return (
                <li key={article.id} className="lc-catalog-card">
                  <div className="lc-catalog-card-head">
                    <ArticleImage
                      article={article}
                      className="lc-catalog-image"
                    />
                    <div className="lc-catalog-card-title">
                      <div className="lc-catalog-title-row">
                        <h2>{article.nom}</h2>
                        <span
                          className={
                            article.online
                              ? 'lc-status-pill lc-status-pill-success'
                              : 'lc-status-pill lc-status-pill-muted'
                          }
                        >
                          {article.online ? 'En ligne' : 'Hors ligne'}
                        </span>
                      </div>
                      <p className="lc-catalog-category">
                        {getArticleCategoryLabel(article.category)}
                      </p>
                    </div>
                  </div>

                  {article.description ? (
                    <p className="lc-catalog-description">
                      {article.description}
                    </p>
                  ) : (
                    <p className="lc-catalog-description">
                      Aucune description renseignée.
                    </p>
                  )}

                  <dl className="lc-catalog-metrics">
                    <div>
                      <dt>Prix TTC</dt>
                      <dd>
                        {formatCurrencyFromCents(article.prixCents)}
                      </dd>
                    </div>
                    <div>
                      <dt>Stock</dt>
                      <dd>
                        {article.stock}
                        <span
                          className={
                            tone === 'danger'
                              ? 'lc-stock-pill lc-stock-pill-danger'
                              : tone === 'warning'
                                ? 'lc-stock-pill lc-stock-pill-warning'
                                : 'lc-stock-pill lc-stock-pill-success'
                          }
                        >
                          {stockLabel(article.stock)}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  <div className="lc-catalog-actions">
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
