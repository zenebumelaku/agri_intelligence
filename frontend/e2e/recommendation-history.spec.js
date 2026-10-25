import { expect, test } from '@playwright/test'

test('saved assessments persist and can be compared', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.removeItem('agrisense.crop-recommendation-history'))

  await page.getByLabel('Growing season').selectOption('Meher')
  await page.getByLabel('Soil type').selectOption('loamy')
  await page.getByLabel('Available water').selectOption('moderate')
  await page.getByRole('button', { name: 'Get crop recommendations' }).click()
  await expect(page.getByRole('article')).toHaveCount(5)

  await page.reload()
  const compare = page.getByLabel('Compare with a saved assessment')
  await expect(compare.locator('option')).toHaveCount(2)

  await page.getByLabel('Growing season').selectOption('Bega')
  await page.getByLabel('Soil type').selectOption('sandy')
  await page.getByLabel('Available water').selectOption('none')
  await page.getByRole('button', { name: 'Get crop recommendations' }).click()
  await expect(page.getByRole('article')).toHaveCount(5)

  await compare.selectOption({ index: 1 })
  await expect(page.getByText('Comparing saved run')).toBeVisible()
  await expect(page.getByText(/vs saved/).first()).toBeVisible()
})
