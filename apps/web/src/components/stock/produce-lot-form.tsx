'use client'

import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

type ArticleOption = {
  id: number
  nom: string
}

type ProduceLotFormProps = {
  articles: ArticleOption[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function ProduceLotForm({ articles }: ProduceLotFormProps) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const [articleId, setArticleId] = useState(articles[0]?.id.toString() ?? '')
  const [quantite, setQuantite] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await authenticatedFetch(
        `${API_URL}/articles/${articleId}/produce`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            quantite: Number(quantite),
          }),
        },
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Impossible d’ajouter ce lot')
      }

      setQuantite('')
      setMessage('Lot article ajouté au stock.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      id="lot-article"
      onSubmit={handleSubmit}
      className="grid gap-4 rounded border bg-white p-4 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold">Lot article</h2>
        <p className="mt-1 text-sm text-gray-600">
          Produit un article fini et consomme sa nomenclature.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor="lot-article-id">Article</label>
          <select
            id="lot-article-id"
            value={articleId}
            onChange={(event) => setArticleId(event.target.value)}
            className="rounded border px-3 py-2"
            required
          >
            {articles.map((article) => (
              <option key={article.id} value={article.id}>
                {article.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label htmlFor="lot-quantite">Quantité</label>
          <input
            id="lot-quantite"
            type="number"
            min="1"
            step="1"
            value={quantite}
            onChange={(event) => setQuantite(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <button
        type="submit"
        disabled={loading || !articleId || Number(quantite) <= 0}
        className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Ajout...' : 'Ajouter le lot'}
      </button>
    </form>
  )
}
