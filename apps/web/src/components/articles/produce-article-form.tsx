'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

type Props = {
  articleId: number
  maxQuantity?: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function ProduceArticleForm({ articleId, maxQuantity }: Props) {
  const router = useRouter()
  const [quantite, setQuantite] = useState('1')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(`${API_URL}/articles/${articleId}/produce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantite: Number(quantite),
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Erreur lors de la production')
      }

      setMessage(`Production de ${quantite} article(s) réussie`)
      setQuantite('1')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-8 rounded border p-6">
      <h2 className="mb-4 text-xl font-bold">Produire</h2>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <input
          type="number"
          min="1"
          max={maxQuantity && maxQuantity > 0 ? maxQuantity : undefined}
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          className="rounded border px-3 py-2"
          placeholder="Quantité à produire"
          required
        />

        {typeof maxQuantity === 'number' ? (
          <p className="text-sm text-gray-600">
            Production max possible : {maxQuantity} unité(s)
          </p>
        ) : null}

        {message ? <p className="text-sm text-green-600">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || Number(quantite) <= 0}
          className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? 'Production...' : 'Produire'}
        </button>
      </form>
    </section>
  )
}