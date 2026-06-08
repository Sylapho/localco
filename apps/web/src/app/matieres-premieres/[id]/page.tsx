import Link from 'next/link'
import { getMatierePremiere } from '@/lib/api'
import DeleteMatierePremiereButton from '@/components/matieres-premieres/delete-matiere-premiere-button'
import { formatCurrencyFromCents } from '@/lib/money'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function MatierePremiereDetailPage({
  params,
}: PageProps) {
  const { id } = await params
  const matiereId = Number(id)
  const matiere = await getMatierePremiere(matiereId)

  return (
    <main className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/matieres-premieres"
          className="rounded border px-3 py-2 text-sm"
        >
          ← Retour à la liste
        </Link>

        <Link
          href={`/matieres-premieres/${matiere.id}/edit`}
          className="rounded border px-3 py-2 text-sm"
        >
          Modifier
        </Link>
      </div>

      <div className="rounded border p-6 shadow-sm">
        <h1 className="text-2xl font-bold">{matiere.nom}</h1>

        <div className="mt-4 grid gap-2">
          <p>
            <span className="font-medium">Stock :</span> {matiere.stock}{' '}
            {matiere.unite}
          </p>
          <p>
            <span className="font-medium">Coût unitaire :</span>{' '}
            {formatCurrencyFromCents(matiere.coutUnitaireCents)}
          </p>
          <p>
            <span className="font-medium">Seuil :</span> {matiere.seuil}
          </p>
          <p>
            <span className="font-medium">Conditionnement :</span>{' '}
            {matiere.conditionnement}
          </p>
        </div>

        <div className="mt-6">
          <DeleteMatierePremiereButton matiereId={matiere.id} />
        </div>
      </div>
    </main>
  )
}
