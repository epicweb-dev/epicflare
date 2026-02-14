import { expect, test } from '@playwright/test'

test('home page renders the shell', async ({ page }) => {
	await page.goto('/')
	await expect(page).toHaveTitle('epicflare')
	await expect(
		page.getByRole('heading', { name: 'epicflare Remix 3' }),
	).toBeVisible()
})

test('navigates between app routes without full document reload', async ({
	page,
}) => {
	let documentRequests = 0

	page.on('request', (request) => {
		if (request.isNavigationRequest() && request.resourceType() === 'document') {
			documentRequests += 1
		}
	})

	await page.goto('/')
	await expect(
		page.getByRole('heading', { name: 'epicflare Remix 3' }),
	).toBeVisible()
	await expect(page.getByRole('link', { name: 'Login' })).toBeVisible()
	await expect.poll(() => documentRequests).toBe(1)

	await page.getByRole('link', { name: 'Login' }).click()
	await expect(page).toHaveURL(/\/login$/)
	await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
	await expect.poll(() => documentRequests).toBe(1)

	await page.getByRole('link', { name: 'Home' }).click()
	await expect(page).toHaveURL(/\/$/)
	await expect(
		page.getByRole('heading', { name: 'epicflare Remix 3' }),
	).toBeVisible()
	await expect.poll(() => documentRequests).toBe(1)
})
