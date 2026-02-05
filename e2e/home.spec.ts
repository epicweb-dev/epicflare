import { expect, test } from '@playwright/test'

test('home page renders the shell', async ({ page }) => {
	await page.goto('/')
	await expect(page).toHaveTitle('epicflare')
	await expect(
		page.getByRole('heading', { name: 'epicflare Remix 3' }),
	).toBeVisible()
})
