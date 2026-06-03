'use client'

import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import type { CommandeStatut } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type CommandeStatusActionsProps = {
  commandeId: number
  statut: CommandeStatut
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function CommandeStatusActions({
  commandeId,
  statut,
}: CommandeStatusActionsProps) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const [loadingStatus, setLoadingStatus] = useState<CommandeStatut | null>(
    null,
  )
  const [error, setError] = useState('')

  async function updateStatus(nextStatus: CommandeStatut) {
    if (
      nextStatus === 'annulee' &&
      !window.confirm('Annuler cette commande et remettre le stock ?')
    ) {
      return
    }

    setLoadingStatus(nextStatus)
    setError('')

    try {
      const response = await authenticatedFetch(
        `${API_URL}/commandes/${commandeId}/statut`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            statut: nextStatus,
          }),
        },
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Impossible de modifier la commande')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoadingStatus(null)
    }
  }

  if (statut === 'traitee' || statut === 'annulee') {
    return null
  }

  if (statut === 'paiement_en_attente') {
    return (
      <div className="grid gap-2">
        <p className="max-w-md text-sm text-gray-600">
          Paiement en attente. Cette commande ne peut pas encore être traitée.
        </p>

        <button
          type="button"
          onClick={() => updateStatus('annulee')}
          disabled={Boolean(loadingStatus)}
          className="w-fit rounded border px-3 py-2 text-sm text-red-700 disabled:opacity-50"
        >
          {loadingStatus === 'annulee' ? 'Annulation...' : 'Annuler'}
        </button>

        {error ? <p className="max-w-md text-sm text-red-600">{error}</p> : null}
      </div>
    )
  }

  if (statut === 'paiement_a_verifier') {
    return (
      <div className="grid gap-2">
        <p className="max-w-md text-sm text-amber-700">
          Paiement reçu, mais le stock est insuffisant. Vérifiez la commande
          avant de contacter le client.
        </p>

        <button
          type="button"
          onClick={() => updateStatus('annulee')}
          disabled={Boolean(loadingStatus)}
          className="w-fit rounded border px-3 py-2 text-sm text-red-700 disabled:opacity-50"
        >
          {loadingStatus === 'annulee' ? 'Annulation...' : 'Annuler'}
        </button>

        {error ? <p className="max-w-md text-sm text-red-600">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {statut === 'nouvelle' ? (
          <button
            type="button"
            onClick={() => updateStatus('preparee')}
            disabled={Boolean(loadingStatus)}
            className="rounded border px-3 py-2 text-sm disabled:opacity-50"
          >
            {loadingStatus === 'preparee' ? 'Préparation...' : 'Préparer'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => updateStatus('traitee')}
          disabled={Boolean(loadingStatus)}
          className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {loadingStatus === 'traitee' ? 'Traitement...' : 'Traiter'}
        </button>

        <button
          type="button"
          onClick={() => updateStatus('annulee')}
          disabled={Boolean(loadingStatus)}
          className="rounded border px-3 py-2 text-sm text-red-700 disabled:opacity-50"
        >
          {loadingStatus === 'annulee' ? 'Annulation...' : 'Annuler'}
        </button>
      </div>

      {error ? <p className="max-w-md text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
