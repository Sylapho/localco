import Link from 'next/link'
import {
  getArticle,
  getArticleNomenclature,
  getProductionCapacity,
} from '@/lib/api'
import DeleteArticleButton from '@/components/articles/delete-article-button'
import ArticleImage from '@/components/articles/article-image'
import ProduceArticleForm from '@/components/articles/produce-article-form'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const { id } = await params
  const articleId = Number(id)

  const [article, nomenclature, capacity] = await Promise.all([
    getArticle(articleId),
    getArticleNomenclature(articleId),
    getProductionCapacity(articleId),
  ])

  const coutTotal = nomenclature.reduce((total, line) => {
    return total + line.quantite * line.mp.coutUnitaire
  }, 0)

  const marge = article.prix - coutTotal

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/articles" className="rounded border px-3 py-2 text-sm">
          ← Retour à la liste
        </Link>

        <Link
          href={`/articles/${article.id}/edit`}
          className="rounded border px-3 py-2 text-sm"
        >
          Modifier
        </Link>

        <Link
          href={`/articles/${article.id}/nomenclature`}
          className="rounded border px-3 py-2 text-sm"
        >
          Gérer la nomenclature
        </Link>
      </div>

      <div className="rounded border p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <ArticleImage
            article={article}
            className="h-24 w-24 overflow-hidden rounded border bg-gray-100"
          />
          <div>
            <h1 className="text-2xl font-bold">{article.nom}</h1>
            <p className="text-sm text-gray-500">ID : {article.id}</p>
          </div>
        </div>

        <div className="grid gap-2">
          <p>
            <span className="font-medium">Prix :</span>{' '}
            {article.prix.toFixed(2)} €
          </p>
          <p>
            <span className="font-medium">Coût matières :</span>{' '}
            {coutTotal.toFixed(2)} €
          </p>
          <p>
            <span className="font-medium">Marge brute estimée :</span>{' '}
            {marge.toFixed(2)} €
          </p>
          <p>
            <span className="font-medium">TVA :</span> {article.tva}
          </p>
          <p>
            <span className="font-medium">Stock :</span> {article.stock}
          </p>
          <p>
            <span className="font-medium">En ligne :</span>{' '}
            {article.online ? 'Oui' : 'Non'}
          </p>
        </div>

        {article.description ? (
          <div className="mt-4">
            <h2 className="mb-1 font-medium">Description</h2>
            <p className="text-gray-700">{article.description}</p>
          </div>
        ) : null}

        <div className="mt-6">
          <DeleteArticleButton articleId={article.id} />
        </div>
      </div>

      <section className="mt-8 rounded border p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Résumé nomenclature</h2>

          <Link
            href={`/articles/${article.id}/nomenclature`}
            className="rounded border px-3 py-2 text-sm"
          >
            Gérer la nomenclature
          </Link>
        </div>

        <div className="mt-4">
          <ProduceArticleForm
            articleId={article.id}
            maxQuantity={capacity.capacite}
          />
        </div>

        <div className="mt-4 rounded bg-gray-50 p-4">
          <p>
            <span className="font-medium">Production possible :</span>{' '}
            {capacity.capacite} unités
          </p>

          {capacity.limitingIngredient ? (
            <p className="mt-1 text-sm text-gray-600">
              Matière limitante : {capacity.limitingIngredient.nom} — stock :{' '}
              {capacity.limitingIngredient.stock}{' '}
              {capacity.limitingIngredient.unite}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-600">
              Aucune nomenclature définie.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <p>
            <span className="font-medium">Nombre de matières :</span>{' '}
            {nomenclature.length}
          </p>

          <p>
            <span className="font-medium">Coût matières estimé :</span>{' '}
            {coutTotal.toFixed(2)} €
          </p>

          <p>
            <span className="font-medium">Marge brute estimée :</span>{' '}
            {marge.toFixed(2)} €
          </p>
        </div>
      </section>
    </main>
  )
}
