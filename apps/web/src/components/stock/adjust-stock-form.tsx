'use client'

import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useRouter } from 'next/navigation'
import { FormEvent, useMemo, useState } from 'react'

type CibleStock = 'article' | 'matiere_premiere'

type ArticleOption = {
  id: number
  nom: string
  stock: number
}

type MatiereOption = {
  id: number
  nom: string
  stock: number
  unite: string
}

type AdjustStockFormProps = {
  articles: ArticleOption[]
  matieres: MatiereOption[]
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function AdjustStockForm({
  articles,
  matieres,
}: AdjustStockFormProps) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const [cible, setCible] = useState<CibleStock>('matiere_premiere')
  const [cibleId, setCibleId] = useState(matieres[0]?.id.toString() ?? '')
  const [quantite, setQuantite] = useState('')
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const options = cible === 'article' ? articles : matieres
  const selectedItem = useMemo(
    () => options.find((item) => item.id === Number(cibleId)),
    [cibleId, options],
  )

  function handleCibleChange(nextCible: CibleStock) {
    setCible(nextCible)
    setCibleId(
      nextCible === 'article'
        ? articles[0]?.id.toString() ?? ''
        : matieres[0]?.id.toString() ?? '',
    )
    setQuantite('')
    setMessage('')
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await authenticatedFetch(
        `${API_URL}/mouvements-stock/ajustement`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cible,
            cibleId: Number(cibleId),
            quantite: Number(quantite),
            motif: motif.trim() || undefined,
          }),
        },
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Impossible d’ajuster le stock')
      }

      setQuantite('')
      setMotif('')
      setMessage('Ajustement enregistré.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded border bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold">Ajustement manuel</h2>
        <p className="mt-1 text-sm text-gray-600">
          Utilise une quantité positive pour ajouter du stock, négative pour en
          retirer.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleCibleChange('matiere_premiere')}
          className={
            cible === 'matiere_premiere'
              ? 'rounded bg-black px-3 py-2 text-sm text-white'
              : 'rounded border px-3 py-2 text-sm'
          }
        >
          Matière première
        </button>
        <button
          type="button"
          onClick={() => handleCibleChange('article')}
          className={
            cible === 'article'
              ? 'rounded bg-black px-3 py-2 text-sm text-white'
              : 'rounded border px-3 py-2 text-sm'
          }
        >
          Article
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor="adjust-cible">Élément</label>
          <select
            id="adjust-cible"
            value={cibleId}
            onChange={(event) => setCibleId(event.target.value)}
            className="rounded border px-3 py-2"
            required
          >
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nom}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1">
          <label htmlFor="adjust-quantite">Variation de stock</label>
          <input
            id="adjust-quantite"
            type="number"
            step={cible === 'article' ? '1' : '0.001'}
            value={quantite}
            onChange={(event) => setQuantite(event.target.value)}
            className="rounded border px-3 py-2"
            placeholder={cible === 'article' ? '-1 ou 3' : '-0.5 ou 10'}
            required
          />
          {selectedItem ? (
            <p className="text-xs text-gray-600">
              Stock actuel : {selectedItem.stock}
              {'unite' in selectedItem ? ` ${selectedItem.unite}` : ''}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-1">
        <label htmlFor="adjust-motif">Motif</label>
        <input
          id="adjust-motif"
          value={motif}
          onChange={(event) => setMotif(event.target.value)}
          className="rounded border px-3 py-2"
          placeholder="Inventaire, casse, correction..."
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <button
        type="submit"
        disabled={loading || !cibleId || Number(quantite) === 0}
        className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Ajustement...' : 'Enregistrer l’ajustement'}
      </button>
    </form>
  )
}
