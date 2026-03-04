import { expect, test, type Page } from '@playwright/test'

async function appendScrollSpacer(page: Page) {
	await page.evaluate(() => {
		let spacer = document.getElementById('router-scroll-spacer')
		if (!spacer) {
			spacer = document.createElement('div')
			spacer.id = 'router-scroll-spacer'
			spacer.style.height = '5000px'
			document.body.appendChild(spacer)
		}
	})
}

async function readRouterScrollState(page: Page) {
	return page.evaluate(() => {
		const key = (window.history.state as { key?: unknown } | null)?.key
		return {
			key: typeof key === 'string' ? key : null,
			scrollY: window.scrollY,
			positionsRaw:
				window.sessionStorage.getItem('react-router-scroll-positions') ?? '{}',
		}
	})
}

test('home page renders the shell', async ({ page }) => {
	await page.goto('/')
	await expect(page).toHaveTitle('epicflare')
	await expect(
		page.getByRole('heading', { name: 'epicflare Remix 3' }),
	).toBeVisible()
})

test('login link navigates without full page reload', async ({ page }) => {
	await page.goto('/')
	const loginLink = page.getByRole('link', { name: 'Login' })
	await expect(loginLink).toBeVisible()

	const marker = await page.evaluate(() => {
		const value = `spa-${Math.random().toString(16).slice(2)}`
		;(window as { __spaMarker?: string }).__spaMarker = value
		return value
	})

	await loginLink.click()
	await expect(page).toHaveURL(/\/login$/)
	await expect(
		page.getByRole('heading', { name: 'Welcome back' }),
	).toBeVisible()

	const markerAfterNavigation = await page.evaluate(
		() => (window as { __spaMarker?: string }).__spaMarker ?? null,
	)
	expect(markerAfterNavigation).toBe(marker)
})

test('back navigation restores scroll position', async ({ page }) => {
	await page.goto('/')
	await appendScrollSpacer(page)
	const expectedHomeScrollY = await page.evaluate(() => {
		window.scrollTo(0, 900)
		return window.scrollY
	})
	expect(expectedHomeScrollY).toBeGreaterThan(0)
	const homeState = await readRouterScrollState(page)
	expect(homeState.key).not.toBeNull()

	await page.evaluate(() => {
		const loginLink = document.querySelector(
			'a[href="/login"]',
		) as HTMLAnchorElement | null
		if (!loginLink) {
			throw new Error('Expected login link to exist.')
		}
		loginLink.click()
	})
	await expect(page).toHaveURL(/\/login$/)
	const loginState = await readRouterScrollState(page)
	expect(loginState.key).not.toBeNull()
	expect(loginState.key).not.toBe(homeState.key)
	const storedHomeY = await page.evaluate((historyKey) => {
		const positions = JSON.parse(
			window.sessionStorage.getItem('react-router-scroll-positions') ?? '{}',
		) as Record<string, number>
		return positions[historyKey] ?? null
	}, homeState.key as string)
	expect(storedHomeY).toBe(expectedHomeScrollY)

	await appendScrollSpacer(page)
	await page.evaluate(() => {
		window.scrollTo(0, 180)
	})
	await expect
		.poll(async () => page.evaluate(() => window.scrollY))
		.toBeGreaterThan(100)

	await page.goBack()
	await expect(page).toHaveURL(/\/$/)
	const backState = await readRouterScrollState(page)
	expect(backState.key).toBe(homeState.key)
	await expect
		.poll(async () => page.evaluate(() => window.scrollY))
		.toBe(expectedHomeScrollY)
})
