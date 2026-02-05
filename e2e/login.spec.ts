import { expect, test } from '@playwright/test'

test('logs in with email and password', async ({ page }) => {
	await page.goto('/login')

	await page.getByLabel('Email').fill('user@example.com')
	await page.getByLabel('Password').fill('password123')
	await page.getByRole('button', { name: 'Sign in' }).click()

	await expect(page.getByText('Signed in successfully.')).toBeVisible()
})

test('signs up with email and password', async ({ page }) => {
	await page.goto('/signup')

	await page.getByLabel('Email').fill('new-user@example.com')
	await page.getByLabel('Password').fill('password123')
	await page.getByRole('button', { name: 'Create account' }).click()

	await expect(page.getByText('Account created successfully.')).toBeVisible()
})
