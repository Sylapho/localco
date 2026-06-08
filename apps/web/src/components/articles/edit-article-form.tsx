'use client'

import type { Article } from '@/lib/api'
import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import { centsToEuros, eurosToCents } from '@/lib/money'
import { useSessionFetch } from '@/lib/use-session-fetch'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

type EditArticleFormProps = {
  article: Article
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function EditArticleForm({
  article,
}: EditArticleFormProps) {
  const router = useRouter()
  const sessionFetch = useSessionFetch()

  const [nom, setNom] = useState(article.nom)
  const [prix, setPrix] = useState(String(centsToEuros(article.prixCents)))
  const [stock, setStock] = useState(String(article.stock))
  const [imageUrl, setImageUrl] = useState(article.imageUrl ?? '')
  const [description, setDescription] = useState(article.description ?? '')
  const [online, setOnline] = useState(article.online)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await sessionFetch(`${API_URL}/articles/${article.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nom,
          prixCents: eurosToCents(Number(prix)),
          stock: Number(stock),
          imageUrl: imageUrl || null,
          description: description || undefined,
          online,
        }),
      })

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, 'Erreur lors de la mise à jour.'),
        )
      }

      router.push(`/articles/${article.id}`)
      router.refresh()
    } catch (err) {
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-xl gap-4">
      <div className="grid gap-1">
        <label htmlFor="nom">Nom</label>
        <input
          id="nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="rounded border px-3 py-2"
          required
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="prix">Prix</label>
        <input
          id="prix"
          type="number"
          step="0.01"
          min="0"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
          className="rounded border px-3 py-2"
          required
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="stock">Stock</label>
        <input
          id="stock"
          type="number"
          min="0"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="rounded border px-3 py-2"
          required
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded border px-3 py-2"
          rows={4}
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="imageUrl">Image</label>
        <input
          id="imageUrl"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="rounded border px-3 py-2"
          placeholder="https://exemple.fr/photo.jpg"
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={online}
          onChange={(e) => setOnline(e.target.checked)}
        />
        En ligne
      </label>

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
          onClick={() => router.push(`/articles/${article.id}`)}
          className="rounded border px-4 py-2"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
