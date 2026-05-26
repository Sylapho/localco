'use client'

import { roleLabels, roles, type Role } from '@/lib/roles'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export default function CreateEmployeeForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('vendeur')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || 'Impossible de creer cet employe')
      }

      setName('')
      setEmail('')
      setPassword('')
      setRole('vendeur')
      setMessage('Employe cree avec succes.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded border bg-white p-4 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-semibold">Creer un employe</h2>
        <p className="mt-1 text-sm text-zinc-600">
          L'employe pourra se connecter avec cet email et ce mot de passe.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor="employee-name">Nom</label>
          <input
            id="employee-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="employee-email">Email</label>
          <input
            id="employee-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="employee-password">Mot de passe temporaire</label>
          <input
            id="employee-password"
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded border px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-1">
          <label htmlFor="employee-role">Role</label>
          <select
            id="employee-role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className="rounded border px-3 py-2"
          >
            {roles.map((item) => (
              <option key={item} value={item}>
                {roleLabels[item]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-700">{message}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-fit rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Creation...' : "Creer l'employe"}
      </button>
    </form>
  )
}
