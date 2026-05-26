'use client'

import type {
  MatierePremiere,
  NomenclatureLine,
} from '@/lib/api'
import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

type Props = {
  articleId: number
  nomenclature: NomenclatureLine[]
  matieres: MatierePremiere[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function ArticleNomenclature({
  articleId,
  nomenclature,
  matieres,
}: Props) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()

  const [mpId, setMpId] = useState('')
  const [quantite, setQuantite] = useState('')
  const [editingKey, setEditingKey] = useState<number | null>(null)
  const [editingQuantite, setEditingQuantite] = useState('')
  const [error, setError] = useState('')

  async function addLine(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const response = await authenticatedFetch(
      `${API_URL}/articles/${articleId}/nomenclature`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mpId: Number(mpId),
          quantite: Number(quantite),
        }),
      },
    )

    if (!response.ok) {
      setError(await response.text())
      return
    }

    setMpId('')
    setQuantite('')
    router.refresh()
  }

  async function updateLine(line: NomenclatureLine) {
    setError('')

    const response = await authenticatedFetch(
      `${API_URL}/articles/${articleId}/nomenclature/${line.mpId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantite: Number(editingQuantite),
        }),
      },
    )

    if (!response.ok) {
      setError(await response.text())
      return
    }

    setEditingKey(null)
    setEditingQuantite('')
    router.refresh()
  }

  async function deleteLine(line: NomenclatureLine) {
    const confirmed = window.confirm('Supprimer cette matière de la recette ?')
    if (!confirmed) return

    setError('')

    const response = await authenticatedFetch(
      `${API_URL}/articles/${articleId}/nomenclature/${line.mpId}`,
      {
        method: 'DELETE',
      },
    )

    if (!response.ok) {
      setError(await response.text())
      return
    }

    router.refresh()
  }

  const usedMpIds = new Set(nomenclature.map((line) => line.mpId))
  const availableMatieres = matieres.filter((mp) => !usedMpIds.has(mp.id))

  return (
    <section className="mt-8 rounded border p-6">
      <h2 className="mb-4 text-xl font-bold">Nomenclature</h2>

      {nomenclature.length === 0 ? (
        <p className="text-sm text-gray-600">Aucune matière première liée.</p>
      ) : (
        <div className="grid gap-3">
          {nomenclature.map((line) => (
            <div
              key={line.mpId}
              className="flex items-center justify-between rounded border p-3"
            >
              <div>
                <p className="font-medium">{line.mp.nom}</p>
                <p className="text-sm text-gray-600">
                  Quantité : {line.quantite} {line.mp.unite}
                </p>
                <p className="text-sm text-gray-600">
                  Coût estimé :{' '}
                  {(line.quantite * line.mp.coutUnitaire).toFixed(2)} €
                </p>
              </div>

              <div className="flex items-center gap-2">
                {editingKey === line.mpId ? (
                  <>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={editingQuantite}
                      onChange={(e) => setEditingQuantite(e.target.value)}
                      className="w-24 rounded border px-2 py-1"
                    />
                    <button
                      onClick={() => updateLine(line)}
                      className="rounded bg-black px-3 py-1 text-sm text-white"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setEditingKey(null)}
                      className="rounded border px-3 py-1 text-sm"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingKey(line.mpId)
                        setEditingQuantite(String(line.quantite))
                      }}
                      className="rounded border px-3 py-1 text-sm"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => deleteLine(line)}
                      className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                    >
                      Supprimer
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={addLine} className="mt-6 grid gap-3">
        <h3 className="font-semibold">Ajouter une matière première</h3>

        <select
          value={mpId}
          onChange={(e) => setMpId(e.target.value)}
          className="rounded border px-3 py-2"
          required
        >
          <option value="">Choisir une matière première</option>
          {availableMatieres.map((mp) => (
            <option key={mp.id} value={mp.id}>
              {mp.nom} — {mp.unite}
            </option>
          ))}
        </select>

        <input
          type="number"
          step="0.001"
          min="0"
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          className="rounded border px-3 py-2"
          placeholder="Quantité utilisée"
          required
        />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={availableMatieres.length === 0}
          className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>
    </section>
  )
}
