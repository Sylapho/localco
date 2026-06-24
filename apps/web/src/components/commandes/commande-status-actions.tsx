'use client'

import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import { useSessionFetch } from '@/lib/use-session-fetch'
import type { CommandeStatut } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type CommandeStatusActionsProps = {
  commandeId: number
  statut: CommandeStatut
  canManage: boolean
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function CommandeStatusActions({
  commandeId,
  statut,
  canManage,
}: CommandeStatusActionsProps) {
  const router = useRouter()
  const sessionFetch = useSessionFetch()
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
      const response = await sessionFetch(
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
        throw new Error(await getApiErrorMessage(response))
      }

      router.refresh()
    } catch (err) {
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoadingStatus(null)
    }
  }

  if (!canManage || statut === 'traitee' || statut === 'annulee') {
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
          className="lc-button lc-button-danger w-fit disabled:opacity-50"
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
          className="lc-button lc-button-danger w-fit disabled:opacity-50"
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
            className="lc-button lc-button-secondary disabled:opacity-50"
          >
            {loadingStatus === 'preparee' ? 'Préparation...' : 'Préparer'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => updateStatus('traitee')}
          disabled={Boolean(loadingStatus)}
          className="lc-button lc-button-primary disabled:opacity-50"
        >
          {loadingStatus === 'traitee' ? 'Traitement...' : 'Traiter'}
        </button>

        <button
          type="button"
          onClick={() => updateStatus('annulee')}
          disabled={Boolean(loadingStatus)}
          className="lc-button lc-button-danger disabled:opacity-50"
        >
          {loadingStatus === 'annulee' ? 'Annulation...' : 'Annuler'}
        </button>
      </div>

      {error ? <p className="max-w-md text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
