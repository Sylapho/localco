import Link from 'next/link'
import NewVenteForm from '@/components/ventes/new-vente-form'
import { getArticles } from '@/lib/api'

export default async function NewVentePage() {
  const articles = await getArticles()

  return (
    <main className="p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Nouvelle vente</h1>
          <p className="mt-1 text-sm text-gray-600">
            Selectionnez les articles, les quantites et le mode de paiement.
          </p>
        </div>

        <Link href="/ventes" className="rounded border px-4 py-2">
          Retour aux ventes
        </Link>
      </div>

      {articles.length === 0 ? (
        <div className="rounded border p-4">
          <p>Aucun article disponible pour creer une vente.</p>
          <Link
            href="/articles/new"
            className="mt-4 inline-block rounded bg-black px-4 py-2 text-white"
          >
            Creer un article
          </Link>
        </div>
      ) : (
        <NewVenteForm articles={articles} />
      )}
    </main>
  )
}
