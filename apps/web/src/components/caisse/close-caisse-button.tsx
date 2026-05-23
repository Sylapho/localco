'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type CloseCaisseButtonProps = {
  disabled: boolean
}

const API_URL = process.env.NEXT_PUBLIC_API_URL

export default function CloseCaisseButton({ disabled }: CloseCaisseButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClose() {
    const confirmed = window.confirm(
      'Cloturer la journee de caisse ? Cette action cree un recapitulatif definitif.',
    )

    if (!confirmed) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/caisse/cloturer`, {
        method: 'POST',
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Erreur lors de la cloture')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
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
        {loading ? 'Cloture...' : 'Cloturer la journee'}
      </button>
      {error ? <p className="max-w-sm text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
