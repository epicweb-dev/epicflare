import { expect, test } from '@playwright/test'

test('home page renders the shell', async ({ page }) => {
	await page.goto('/')
	await expect(page).toHaveTitle('Epicflare')
	await expect(
		page.getByRole('heading', { name: 'Epicflare Remix 3' }),
	).toBeVisible()
})
