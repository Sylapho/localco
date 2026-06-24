'use client'

import { getApiErrorMessage, getUnknownErrorMessage } from '@/lib/api-error'
import { roleLabels, roles, type Role } from '@/lib/roles'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

type UserRoleSelectProps = {
  userId: string
  role: Role
  disabled?: boolean
}

export default function UserRoleSelect({
  userId,
  role,
  disabled = false,
}: UserRoleSelectProps) {
  const router = useRouter()
  const [value, setValue] = useState<Role>(role)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function updateRole(nextRole: Role) {
    setValue(nextRole)
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: nextRole }),
      })

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response))
      }

      router.refresh()
    } catch (err) {
      setValue(role)
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-1">
      <select
        value={value}
        onChange={(event) => updateRole(event.target.value as Role)}
        disabled={disabled || loading}
        className="rounded-xl border px-3 py-2 text-sm disabled:opacity-60"
      >
        {roles.map((item) => (
          <option key={item} value={item}>
            {roleLabels[item]}
          </option>
        ))}
      </select>
      {disabled ? (
        <span className="text-xs text-zinc-500">Ton compte</span>
      ) : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
