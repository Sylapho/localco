import { expect, test } from '@playwright/test'

test('shop renders catalog data from the real API and PostgreSQL', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Produits disponibles' }),
  ).toBeVisible()
  await expect(page.getByText('Terrine de poulet normande')).toBeVisible()
})
