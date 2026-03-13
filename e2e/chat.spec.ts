import { expect, test } from './playwright-utils.ts'

test('redirects to login when unauthenticated', async ({ page }) => {
	await page.goto('/chat')
	await expect(page).toHaveURL(/\/login/)
})

test('loads chat page when authenticated', async ({ page, login }) => {
	await login()
	await page.goto('/chat')
	await expect(page.getByRole('heading', { name: 'Chat' })).toBeVisible()
	await expect(
		page.getByRole('button', { name: 'Create your first thread' }),
	).toBeVisible()
})

test('creates and deletes chat threads when authenticated', async ({
	page,
	login,
}) => {
	await login()
	await page.goto('/chat')

	await page.getByRole('button', { name: 'Create your first thread' }).click()
	await expect(page).toHaveURL(/\/chat\/.+/)
	await expect(page.getByRole('heading', { name: 'New chat' })).toBeVisible()

	await page.getByRole('button', { name: 'Delete' }).click()
	await expect(page).toHaveURL(/\/chat$/)
	await expect(
		page.getByRole('button', { name: 'Create your first thread' }),
	).toBeVisible()
})
