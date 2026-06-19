'use client'

import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import { useSessionFetch } from '@/lib/use-session-fetch'
import type { CommandeStatut } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type PreparationStatusActionsProps = {
  commandeId: number
  statut: CommandeStatut
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function PreparationStatusActions({
  commandeId,
  statut,
}: PreparationStatusActionsProps) {
  const router = useRouter()
  const sessionFetch = useSessionFetch()
  const [loadingStatus, setLoadingStatus] = useState<CommandeStatut | null>(
    null,
  )
  const [error, setError] = useState('')

  const nextStatus = getNextStatus(statut)

  async function updateStatus(status: CommandeStatut) {
    setLoadingStatus(status)
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
            statut: status,
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

  if (!nextStatus) {
    return null
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => updateStatus(nextStatus)}
        disabled={Boolean(loadingStatus)}
        className={
          nextStatus === 'traitee'
            ? 'rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50'
            : 'rounded border px-3 py-2 text-sm disabled:opacity-50'
        }
      >
        {loadingStatus
          ? 'Mise à jour...'
          : nextStatus === 'preparee'
            ? 'Marquer préparée'
            : 'Marquer traitée'}
      </button>

      {error ? <p className="max-w-md text-sm text-red-600">{error}</p> : null}
    </div>
  )
}

function getNextStatus(statut: CommandeStatut): CommandeStatut | null {
  if (statut === 'nouvelle') {
    return 'preparee'
  }

  if (statut === 'preparee') {
    return 'traitee'
  }

  return null
}
