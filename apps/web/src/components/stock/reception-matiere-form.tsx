'use client'

import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'

type MatiereOption = {
  id: number
  nom: string
  unite: string
}

type ReceptionMatiereFormProps = {
  matieres: MatiereOption[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function ReceptionMatiereForm({
  matieres,
}: ReceptionMatiereFormProps) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const [matiereId, setMatiereId] = useState(matieres[0]?.id.toString() ?? '')
  const [quantite, setQuantite] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedMatiere = useMemo(
    () => matieres.find((matiere) => matiere.id === Number(matiereId)),
    [matiereId, matieres],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await authenticatedFetch(
        `${API_URL}/mouvements-stock/matieres-premieres/${matiereId}/reception`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantite: Number(quantite),
            expiresAt: expiresAt || undefined,
            motif: motif.trim() || undefined,
          }),
        },
      )

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response))
      }

      setQuantite('')
      setExpiresAt('')
      setMotif('')
      setMessage('Réception enregistrée.')
      router.refresh()
    } catch (err) {
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded border bg-white p-4 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold">Réception de matière</h2>
        <p className="mt-1 text-sm text-gray-600">
          Ajoute une livraison au stock d’une matière première.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor="reception-matiere">Matière première</label>
          <select
            id="reception-matiere"
            value={matiereId}
            onChange={(event) => setMatiereId(event.target.value)}
            className="rounded border px-3 py-2"
            required
          >
            {matieres.map((matiere) => (
              <option key={matiere.id} value={matiere.id}>
                {matiere.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label htmlFor="reception-quantite">
            Quantité {selectedMatiere ? `(${selectedMatiere.unite})` : ''}
          </label>
          <input
            id="reception-quantite"
            type="number"
            min="0.001"
            step="0.001"
            value={quantite}
            onChange={(event) => setQuantite(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
        </div>
      </div>

      <div className="grid gap-1">
        <label htmlFor="reception-dlc">DLC</label>
        <input
          id="reception-dlc"
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
          className="rounded border px-3 py-2"
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="reception-motif">Motif</label>
        <input
          id="reception-motif"
          value={motif}
          onChange={(event) => setMotif(event.target.value)}
          className="rounded border px-3 py-2"
          placeholder="Livraison fournisseur"
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <button
        type="submit"
        disabled={loading || !matiereId || Number(quantite) <= 0}
        className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Enregistrement...' : 'Enregistrer la réception'}
      </button>
    </form>
  )
}
