'use client'

import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Props = {
  matiereId: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function DeleteMatierePremiereButton({ matiereId }: Props) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    const confirmed = window.confirm(
      'Voulez-vous vraiment supprimer cette matière première ?',
    )

    if (!confirmed) return

    setLoading(true)
    setError('')

    try {
      const response = await authenticatedFetch(`${API_URL}/matieres-premieres/${matiereId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Erreur lors de la suppression')
      }

      router.push('/matieres-premieres')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="w-fit rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Suppression...' : 'Supprimer'}
      </button>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
