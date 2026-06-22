'use client'

import { getUnknownErrorMessage } from '@/lib/api-error'
import { authClient } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export default function AuthForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: '/',
      })

      if (result.error) {
        throw new Error(result.error.message || 'Authentification impossible')
      }

      router.push('/')
      router.refresh()
    } catch (err) {
      setError(getUnknownErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid w-full max-w-sm gap-4 rounded border bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Les cocottes de Diane
        </p>
        <h1 className="mt-2 text-2xl font-bold">
          Connexion
        </h1>
      </div>

      <div className="grid gap-1">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded border px-3 py-2"
          required
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded border px-3 py-2"
          required
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? 'Chargement...' : 'Se connecter'}
      </button>
    </form>
  )
}
