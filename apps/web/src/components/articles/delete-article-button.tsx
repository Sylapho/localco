'use client'

import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type DeleteArticleButtonProps = {
  articleId: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function DeleteArticleButton({
  articleId,
}: DeleteArticleButtonProps) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    const confirmed = window.confirm(
      'Voulez-vous vraiment supprimer cet article ?',
    )

    if (!confirmed) return

    setError('')
    setLoading(true)

    try {
      const response = await authenticatedFetch(`${API_URL}/articles/${articleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Erreur lors de la suppression')
      }

      router.push('/articles')
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
