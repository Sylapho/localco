import { PrismaService } from '../../src/prisma/prisma.service'

const DEFAULT_E2E_DATABASE_URL =
  'postgresql://localco:localco_dev@localhost:5432/localco_e2e'

export function prepareE2eEnvironment() {
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = getE2eDatabaseUrl()
  process.env.BETTER_AUTH_SECRET ||= 'test_better_auth_secret_at_least_32_chars'
  process.env.BETTER_AUTH_URL ||= 'http://localhost:4000'
  process.env.SHOP_PUBLIC_URL ||= 'http://localhost:3001'
  process.env.STRIPE_SECRET_KEY ||= 'sk_test_localco_e2e'
  process.env.STRIPE_WEBHOOK_SECRET ||= 'whsec_localco_e2e_secret'
  process.env.CHECKOUT_RATE_LIMIT_MAX ||= '1000'
  process.env.ABANDONED_ORDER_DELAY_MINUTES ||= '60'

  assertSafeE2eDatabaseUrl(process.env.DATABASE_URL)
}

export function getE2eDatabaseUrl() {
  const configuredUrl = process.env.DATABASE_URL

  if (configuredUrl && configuredUrl.includes('e2e')) {
    return configuredUrl
  }

  return DEFAULT_E2E_DATABASE_URL
}

export function assertSafeE2eDatabaseUrl(databaseUrl: string | undefined) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('E2E tests must run with NODE_ENV=test')
  }

  if (!databaseUrl || !databaseUrl.includes('e2e')) {
    throw new Error('E2E DATABASE_URL must target an explicit e2e database')
  }
}

export async function truncateBusinessTables(prisma: PrismaService) {
  assertSafeE2eDatabaseUrl(process.env.DATABASE_URL)

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `

  if (tables.length === 0) {
    return
  }

  const tableNames = tables
    .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
    .join(', ')

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`,
  )
}
