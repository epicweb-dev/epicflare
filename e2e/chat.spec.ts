import { expect, test } from './playwright-utils.ts'

test('redirects to login when unauthenticated', async ({ page }) => {
	await page.goto('/chat')
	await expect(page).toHaveURL(/\/login/)
})

test('loads chat page when authenticated', async ({ page, login }) => {
	await login()
	await page.goto('/chat')
	await expect(page).toHaveURL(/\/chat$/)

	// Check that we don't get redirected to login and the shell is visible
	await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible()
})
