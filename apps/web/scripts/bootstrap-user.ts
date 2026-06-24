import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { roles, type Role } from '../src/lib/roles'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(scriptDir, '..')
const repoRoot = resolve(webRoot, '..', '..')

for (const envFile of [
  resolve(repoRoot, '.env'),
  resolve(webRoot, '.env'),
  resolve(webRoot, '.env.local'),
]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile)
  }
}

const email = process.env.BOOTSTRAP_USER_EMAIL?.trim().toLowerCase()
const password = process.env.BOOTSTRAP_USER_PASSWORD
const name = process.env.BOOTSTRAP_USER_NAME?.trim() || 'Admin'
const role = process.env.BOOTSTRAP_USER_ROLE?.trim() || 'gerant'

function isRole(value: string): value is Role {
  return roles.includes(value as Role)
}

async function main() {
  if (!email) {
    throw new Error('BOOTSTRAP_USER_EMAIL is required')
  }

  if (!password) {
    throw new Error('BOOTSTRAP_USER_PASSWORD is required')
  }

  if (password.length < 8) {
    throw new Error('BOOTSTRAP_USER_PASSWORD must contain at least 8 characters')
  }

  if (!isRole(role)) {
    throw new Error(
      `BOOTSTRAP_USER_ROLE must be one of: ${roles.join(', ')}`,
    )
  }

  const { auth } = await import('../src/lib/auth')

  const result = await auth.api.createUser({
    body: {
      email,
      password,
      name,
      role,
    },
  })

  console.log(`User created: ${result.user.email} (${role})`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
