import { expect, test, type APIRequestContext } from '@playwright/test'

const testUser = { email: 'user@example.com', password: 'password123' }

async function ensureUserExists(request: APIRequestContext) {
	const response = await request.post('/auth', {
		data: { ...testUser, mode: 'signup' },
		headers: { 'Content-Type': 'application/json' },
	})
	if (response.ok() || response.status() === 409) {
		return
	}
	throw new Error(`Failed to seed user (${response.status()}).`)
}

test('logs in with email and password', async ({ page }) => {
	await ensureUserExists(page.request)
	await page.context().clearCookies()
	await page.goto('/login')

	await page.getByLabel('Email').fill(testUser.email)
	await page.getByLabel('Password').fill(testUser.password)
	await page.getByRole('button', { name: 'Sign in' }).click()

	await expect(page).toHaveURL(/\/account$/)
	await expect(
		page.getByRole('heading', { name: `Welcome, ${testUser.email}` }),
	).toBeVisible()
})

test('signs up with email and password', async ({ page }) => {
	await page.goto('/signup')

	await page.getByLabel('Email').fill('new-user@example.com')
	await page.getByLabel('Password').fill('password123')
	await page.getByRole('button', { name: 'Create account' }).click()

	await expect(page).toHaveURL(/\/account$/)
	await expect(
		page.getByRole('heading', { name: 'Welcome, new-user@example.com' }),
	).toBeVisible()
})
