import { expect, test } from '@playwright/test'

test('redirects unauthenticated account to login with redirectTo', async ({
	page,
}) => {
	await page.context().clearCookies()
	await page.goto('/account')
	await expect(page).toHaveURL(/\/login\?redirectTo=%2Faccount$/)
	await expect(
		page.getByRole('heading', { name: 'Welcome back' }),
	).toBeVisible()
})

test('redirects authenticated user from login to account', async ({ page }) => {
	await page.goto('/login')
	await page.getByLabel('Email').fill('user@example.com')
	await page.getByLabel('Password').fill('password123')
	await page.getByRole('button', { name: 'Sign in' }).click()

	await expect(page).toHaveURL(/\/account$/)

	await page.goto('/login')
	await expect(page).toHaveURL(/\/account$/)
})

test('logs out from the account page', async ({ page }) => {
	await page.goto('/login')
	await page.getByLabel('Email').fill('user@example.com')
	await page.getByLabel('Password').fill('password123')
	await page.getByRole('button', { name: 'Sign in' }).click()

	await expect(page).toHaveURL(/\/account$/)
	await page.getByRole('button', { name: 'Log out' }).click()

	await expect(page).toHaveURL(/\/login$/)
	await expect(
		page.getByRole('heading', { name: 'Welcome back' }),
	).toBeVisible()
})
