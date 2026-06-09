import { defineConfig, devices } from '@playwright/test'

const shopPort = Number(process.env.PLAYWRIGHT_SHOP_PORT ?? 3101)
const mockApiPort = Number(process.env.PLAYWRIGHT_MOCK_API_PORT ?? 4010)
const shopBaseUrl = `http://localhost:${shopPort}`
const mockApiBaseUrl = `http://127.0.0.1:${mockApiPort}`

process.env.NEXT_PUBLIC_API_URL = `${mockApiBaseUrl}/api`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: shopBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node tests/e2e/mock-api-server.mjs',
      url: `${mockApiBaseUrl}/__mock/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        PLAYWRIGHT_MOCK_API_PORT: String(mockApiPort),
      },
    },
    {
      command: `pnpm exec next dev -p ${shopPort}`,
      url: shopBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: `${mockApiBaseUrl}/api`,
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
