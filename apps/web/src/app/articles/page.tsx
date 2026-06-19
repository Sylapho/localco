import Link from 'next/link'
import ArticleImage from '@/components/articles/article-image'
import { getArticles } from '@/lib/api'
import { getArticleCategoryLabel } from '@/lib/article-categories'
import { requireUiPermission } from '@/lib/auth-session'
import { formatCurrencyFromCents } from '@/lib/money'
import { canManageArticles, canViewArticles } from '@/lib/permissions'

export default async function ArticlesPage() {
  const session = await requireUiPermission(canViewArticles)
  const userCanManageArticles = canManageArticles(session.user)
  const articles = await getArticles()

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Articles</h1>
        {userCanManageArticles ? (
          <Link
            href="/articles/new"
            className="rounded bg-black px-4 py-2 text-white"
          >
            Nouvel article
          </Link>
        ) : null}
      </div>

      {articles.length === 0 ? (
        <p>Aucun article disponible.</p>
      ) : (
        <ul className="grid gap-4">
          {articles.map((article) => (
            <li key={article.id} className="rounded border p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ArticleImage article={article} />
                <h2 className="text-lg font-semibold">{article.nom}</h2>
              </div>

              <p className="mt-2">
                Prix : {formatCurrencyFromCents(article.prixCents)}
              </p>
              <p>Catégorie : {getArticleCategoryLabel(article.category)}</p>
              <p>Stock : {article.stock}</p>
              <p>En ligne : {article.online ? 'Oui' : 'Non'}</p>

              {article.description ? (
                <p className="mt-2 text-sm text-gray-600">
                  {article.description}
                </p>
              ) : null}

              <div className="mt-4 flex gap-3">
                <Link
                  href={`/articles/${article.id}`}
                  className="rounded border px-3 py-2 text-sm"
                >
                  Voir
                </Link>

                {userCanManageArticles ? (
                  <Link
                    href={`/articles/${article.id}/edit`}
                    className="rounded border px-3 py-2 text-sm"
                  >
                    Modifier
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
