import Link from 'next/link'
import { getMatierePremiere } from '@/lib/api'
import EditMatierePremiereForm from '@/components/matieres-premieres/edit-matiere-premiere-form'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function EditMatierePremierePage({
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
          href={`/matieres-premieres/${matiere.id}`}
          className="rounded border px-3 py-2 text-sm"
        >
          Voir la matière première
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">Modifier : {matiere.nom}</h1>

      <EditMatierePremiereForm matiere={matiere} />
    </main>
  )
}