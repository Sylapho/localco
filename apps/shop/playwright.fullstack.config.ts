import { defineConfig, devices } from '@playwright/test'

const shopPort = Number(process.env.PLAYWRIGHT_SHOP_PORT ?? 3102)
const apiPort = Number(process.env.PORT ?? 4000)
const shopBaseUrl = `http://127.0.0.1:${shopPort}`
const apiOrigin = `http://127.0.0.1:${apiPort}`
const apiBaseUrl = `${apiOrigin}/api`
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://localco:localco_dev@localhost:5432/localco_smoke'

export default defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/fullstack-smoke',
  use: {
    baseURL: shopBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @localco/api start:prod',
      url: `${apiBaseUrl}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(apiPort),
        DATABASE_URL: databaseUrl,
        BETTER_AUTH_SECRET: 'localco-ci-better-auth-secret-placeholder',
        BETTER_AUTH_URL: apiOrigin,
        FRONTEND_URL: 'http://127.0.0.1:3000',
        SHOP_PUBLIC_URL: shopBaseUrl,
        API_CORS_ORIGINS: shopBaseUrl,
        STRIPE_SECRET_KEY: 'localco-ci-stripe-placeholder',
        STRIPE_WEBHOOK_SECRET: 'localco-ci-stripe-webhook-placeholder',
        RESEND_API_KEY: '',
      },
    },
    {
      command: 'node tests/e2e/start-standalone.mjs',
      url: shopBaseUrl,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(shopPort),
        HOSTNAME: '127.0.0.1',
        API_INTERNAL_URL: apiBaseUrl,
        NEXT_PUBLIC_API_URL: apiBaseUrl,
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
