import { expect, test } from '@playwright/test'

test('farmers receive ranked crop recommendations with transparent caveats', async ({ page }) => {
  await page.goto('/')
  await page.locator('#advisor-region').selectOption('Amhara')
  await page.getByLabel('Growing season').selectOption('Meher')
  await page.getByLabel('Soil type').selectOption('loamy')
  await page.getByLabel('Available water').selectOption('moderate')
  await page.getByLabel('Farm size').fill('2.5')
  await page.getByRole('button', { name: 'Get crop recommendations' }).click()

  await expect(page.getByRole('heading', { name: 'Ranked options for Amhara' })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(5)
  const planner = page.locator('#planner')
  for (const crop of ['Teff', 'Maize', 'Wheat', 'Sorghum', 'Coffee']) {
    await expect(planner.getByRole('heading', { name: crop, exact: true })).toBeVisible()
  }
  await expect(planner.getByText(/soil fit:/i)).toHaveCount(5)
  await expect(page.getByText('Limitation:', { exact: false }).first()).toBeVisible()

  await page.getByText('How to interpret these results').click()
  await expect(page.getByText(/not a trained or locally validated yield model/)).toBeVisible()
  await expect(page.getByText('Soil pH, nutrient levels, drainage, and field-specific soil test results')).toBeVisible()

  const invalidResponse = await page.request.post('http://127.0.0.1:8001/api/ml/crop-recommendations', {
    data: {
      region: 'Unknown',
      season: 'Meher',
      soil_type: 'loamy',
      water_availability: 'moderate',
      farm_size_ha: 2.5,
    },
  })
  expect(invalidResponse.status()).toBe(422)
})
