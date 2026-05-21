'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function NewArticlePage() {
  const router = useRouter()

  const [nom, setNom] = useState('')
  const [prix, setPrix] = useState('')
  const [stock, setStock] = useState('')
  const [emoji, setEmoji] = useState('🥖')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nom,
          prix: Number(prix),
          stock: Number(stock || 0),
          online: true,
          emoji,
          description: description || undefined,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Erreur lors de la création')
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
          <label htmlFor="emoji">Emoji</label>
          <input
            id="emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
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