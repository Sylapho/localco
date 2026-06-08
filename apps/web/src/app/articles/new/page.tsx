'use client'

import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import { eurosToCents } from '@/lib/money'
import { useSessionFetch } from '@/lib/use-session-fetch'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function NewArticlePage() {
  const router = useRouter()
  const sessionFetch = useSessionFetch()

  const [nom, setNom] = useState('')
  const [prix, setPrix] = useState('')
  const [stock, setStock] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await sessionFetch(`${API_URL}/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nom,
          prixCents: eurosToCents(Number(prix)),
          stock: Number(stock || 0),
          online: true,
          imageUrl: imageUrl || undefined,
          description: description || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(response, 'Erreur lors de la création.'),
        )
      }

      router.push('/articles')
      router.refresh()
    } catch (err) {
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-8">
      <h1 className="mb-6 text-2xl font-bold">Créer un article</h1>

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
          <p className="text-sm text-gray-600">
            Pour le moment, colle une URL d&apos;image. On pourra ajouter
            l&apos;upload de fichier ensuite.
          </p>
        </div>

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
