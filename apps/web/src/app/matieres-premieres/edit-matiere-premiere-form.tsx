'use client'

import type { MatierePremiere } from '@/lib/api'
import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

type Props = {
  matiere: MatierePremiere
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function EditMatierePremiereForm({ matiere }: Props) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()

  const [nom, setNom] = useState(matiere.nom)
  const [stock, setStock] = useState(String(matiere.stock))
  const [unite, setUnite] = useState(matiere.unite)
  const [coutUnitaire, setCoutUnitaire] = useState(
    String(matiere.coutUnitaire),
  )
  const [seuil, setSeuil] = useState(String(matiere.seuil))
  const [conditionnement, setConditionnement] = useState(
    matiere.conditionnement,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await authenticatedFetch(
        `${API_URL}/matieres-premieres/${matiere.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nom,
            stock: Number(stock),
            unite,
            coutUnitaire: Number(coutUnitaire),
            seuil: Number(seuil),
            conditionnement,
          }),
        },
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Erreur lors de la mise à jour')
      }

      router.push(`/matieres-premieres/${matiere.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
      <input
        value={nom}
        onChange={(e) => setNom(e.target.value)}
        className="rounded border px-3 py-2"
        placeholder="Nom"
        required
      />
      <input
        value={stock}
        onChange={(e) => setStock(e.target.value)}
        type="number"
        step="0.01"
        min="0"
        className="rounded border px-3 py-2"
        placeholder="Stock"
        required
      />
      <input
        value={unite}
        onChange={(e) => setUnite(e.target.value)}
        className="rounded border px-3 py-2"
        placeholder="Unité"
        required
      />
      <input
        value={coutUnitaire}
        onChange={(e) => setCoutUnitaire(e.target.value)}
        type="number"
        step="0.01"
        min="0"
        className="rounded border px-3 py-2"
        placeholder="Coût unitaire"
        required
      />
      <input
        value={seuil}
        onChange={(e) => setSeuil(e.target.value)}
        type="number"
        step="0.01"
        min="0"
        className="rounded border px-3 py-2"
        placeholder="Seuil"
        required
      />
      <input
        value={conditionnement}
        onChange={(e) => setConditionnement(e.target.value)}
        className="rounded border px-3 py-2"
        placeholder="Conditionnement"
        required
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/matieres-premieres/${matiere.id}`)}
          className="rounded border px-4 py-2"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
