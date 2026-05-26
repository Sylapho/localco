import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'
import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL est manquante')
}

const socialProviders = {
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
        },
      }
    : {}),
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}),
}

const ac = createAccessControl({
  ...defaultStatements,
} as const)

const gerant = ac.newRole({
  ...adminAc.statements,
})

const employee = ac.newRole({})

export const auth = betterAuth({
  database: new Pool({
    connectionString: databaseUrl,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  socialProviders,
  plugins: [
    admin({
      ac,
      roles: {
        gerant,
        vendeur: employee,
        production: employee,
        stock: employee,
        comptable: employee,
      },
      defaultRole: 'vendeur',
    }),
  ],
})

export default auth
