'use client'

import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import { useAuthenticatedFetch } from '@/lib/use-authenticated-fetch'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type CloseCaisseButtonProps = {
  disabled: boolean
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function CloseCaisseButton({ disabled }: CloseCaisseButtonProps) {
  const router = useRouter()
  const authenticatedFetch = useAuthenticatedFetch()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClose() {
    const confirmed = window.confirm(
      'Clôturer la journée de caisse ? Cette action crée un récapitulatif définitif.',
    )

    if (!confirmed) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await authenticatedFetch(`${API_URL}/caisse/cloturer`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response))
      }

      router.refresh()
    } catch (err) {
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleClose}
        disabled={disabled || loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Clôture...' : 'Clôturer la journée'}
      </button>
      {error ? <p className="max-w-sm text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
