import { expect, test } from '@playwright/test'

const mockApiBaseUrl = `http://127.0.0.1:${process.env.PLAYWRIGHT_MOCK_API_PORT ?? 4010}`

test.beforeEach(async ({ request }) => {
  await request.post(`${mockApiBaseUrl}/__mock/reset`)
})

test('checkout displays an empty cart state', async ({ page }) => {
  await page.goto('/checkout')

  await expect(
    page.getByRole('heading', { name: 'Votre panier est vide' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Voir les produits' })).toHaveAttribute(
    'href',
    '/#produits',
  )
})

test('shop user can add a product and create a checkout session', async ({
  page,
  request,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Produits disponibles' }),
  ).toBeVisible()
  await expect(page.getByText('Terrine de volaille')).toBeVisible()

  await page
    .locator('article')
    .filter({ hasText: 'Terrine de volaille' })
    .getByRole('button', { name: 'Ajouter' })
    .click()

  await expect(page.getByRole('button', { name: 'Panier (1)' })).toBeVisible()
  await page.getByRole('button', { name: 'Panier (1)' }).click()
  await expect(
    page.getByRole('heading', { name: 'Votre commande' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Continuer vers le paiement' }).click()

  await expect(
    page.getByRole('heading', { name: 'Finaliser ma commande' }),
  ).toBeVisible()
  await expect(page.getByText('Terrine de volaille')).toBeVisible()

  await page.locator('#nom').fill('Marie Dupont')
  await page.locator('#email').fill('marie@example.fr')
  await page.locator('#tel').fill('0612345678')

  await page.locator('button[form="checkout-form"]').click()
  await page.waitForURL(`${mockApiBaseUrl}/stripe/checkout-session`)
  await expect(page.getByText('Stripe checkout mock')).toBeVisible()

  const checkoutResponse = await request.get(
    `${mockApiBaseUrl}/__mock/last-checkout`,
  )
  const checkout = (await checkoutResponse.json()) as {
    payload: {
      nom: string
      email: string
      tel: string
      lieu: string
      dateRetrait: string
      lignes: { articleId: number; quantite: number }[]
    }
  }

  expect(checkout.payload).toMatchObject({
    nom: 'Marie Dupont',
    email: 'marie@example.fr',
    tel: '0612345678',
    lieu: 'Marche de Gaillon - Mardi matin, 8h-12h',
    lignes: [{ articleId: 1, quantite: 1 }],
  })
  expect(checkout.payload.dateRetrait).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})
