import Link from 'next/link'
import {
  getArticle,
  getArticleNomenclature,
  getMatieresPremieres,
} from '@/lib/api'
import ArticleNomenclature from '@/components/articles/article-nomenclature'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ArticleNomenclaturePage({ params }: PageProps) {
  const { id } = await params
  const articleId = Number(id)

  const [article, nomenclature, matieres] = await Promise.all([
    getArticle(articleId),
    getArticleNomenclature(articleId),
    getMatieresPremieres(),
  ])

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/articles" className="rounded border px-3 py-2 text-sm">
          ← Liste articles
        </Link>

        <Link
          href={`/articles/${article.id}`}
          className="rounded border px-3 py-2 text-sm"
        >
          Retour article
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">
        Nomenclature : {article.emoji} {article.nom}
      </h1>

      <ArticleNomenclature
        articleId={article.id}
        nomenclature={nomenclature}
        matieres={matieres}
      />
    </main>
  )
}