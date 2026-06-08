'use client'

import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import { eurosToCents } from '@/lib/money'
import { useSessionFetch } from '@/lib/use-session-fetch'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function NewMatierePremierePage() {
  const router = useRouter()
  const sessionFetch = useSessionFetch()

  const [nom, setNom] = useState('')
  const [stock, setStock] = useState('')
  const [unite, setUnite] = useState('')
  const [coutUnitaire, setCoutUnitaire] = useState('')
  const [seuil, setSeuil] = useState('')
  const [conditionnement, setConditionnement] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await sessionFetch(`${API_URL}/matieres-premieres`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nom,
          stock: Number(stock),
          unite,
          coutUnitaireCents: eurosToCents(Number(coutUnitaire)),
          seuil: Number(seuil),
          conditionnement,
        }),
      })

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response))
      }

      router.push('/matieres-premieres')
      router.refresh()
    } catch (err) {
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Nouvelle matière première</h1>

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

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Création...' : 'Créer'}
        </button>
      </form>
    </main>
  )
}
