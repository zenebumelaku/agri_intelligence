import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

test('dashboard loads and offers region filtering', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'AgriSense' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Analytics overview' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Personalized crop recommendations' })).toBeVisible()

  const region = page.locator('#region-filter')
  await expect(region).toHaveValue('All')
  await region.selectOption('Oromia')
  await expect(page.getByRole('heading', { name: 'Oromia focus' })).toBeVisible()

  const screenshotPath = resolve(process.cwd(), '../docs/images/agrisense-dashboard.png')
  await mkdir(resolve(process.cwd(), '../docs/images'), { recursive: true })
  await page.screenshot({ path: screenshotPath, animations: 'disabled' })
})
