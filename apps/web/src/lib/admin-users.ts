import 'server-only'

import { auth } from '@/lib/auth'
import { isRole, type Role } from '@/lib/roles'
import { headers } from 'next/headers'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL est manquante')
}

const pool = new Pool({
  connectionString: databaseUrl,
})

type AuthSession = {
  user: {
    id: string
    role?: unknown
  }
}

export type AdminUser = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: Date
}

export async function getCurrentAuthSession() {
  return (await auth.api.getSession({
    headers: await headers(),
  })) as AuthSession | null
}

export async function requireGerantSession() {
  const session = await getCurrentAuthSession()

  if (!session || session.user.role !== 'gerant') {
    return null
  }

  return session
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const result = await pool.query<{
    id: string
    name: string | null
    email: string
    role: string | null
    createdAt: Date
  }>(
    'SELECT id, name, email, role, "createdAt" FROM "user" ORDER BY "createdAt" DESC',
  )

  return result.rows.map((user) => ({
    id: user.id,
    name: user.name ?? 'Sans nom',
    email: user.email,
    role: isRole(user.role) ? user.role : 'vendeur',
    createdAt: user.createdAt,
  }))
}

export async function updateUserRole(userId: string, role: Role) {
  await pool.query('UPDATE "user" SET role = $1, "updatedAt" = NOW() WHERE id = $2', [
    role,
    userId,
  ])
}

export async function createEmployee(data: {
  name: string
  email: string
  password: string
  role: Role
}) {
  const requestHeaders = await headers()

  const user = await auth.api.createUser({
    body: {
      name: data.name,
      email: data.email,
      password: data.password,
    },
    headers: requestHeaders,
  })

  await updateUserRole(user.user.id, data.role)

  return user
}
