import { expect, test } from '@playwright/test'

test('logs in with email and password', async ({ page }) => {
	await page.goto('/login')

	await page.getByLabel('Email').fill('user@example.com')
	await page.getByLabel('Password').fill('password123')
	await page.getByRole('button', { name: 'Sign in' }).click()

	await expect(page).toHaveURL(/\/account$/)
	await expect(
		page.getByRole('heading', { name: 'Welcome, user@example.com' }),
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
