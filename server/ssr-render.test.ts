/// <reference types="bun" />
import { expect, test } from 'vitest'
import { type AppEnv } from '#types/env-schema.ts'
import { createAuthCookie, setAuthSessionSecret } from './auth-session.ts'
import { renderAppPage } from './ssr-render.tsx'

const testAppEnv = {
	COOKIE_SECRET: 'test-cookie-secret-0123456789abcdef0123456789',
	APP_DB: {} as D1Database,
} as AppEnv

test('renderAppPage server-renders route content and hydration metadata', async () => {
	const response = await renderAppPage({
		request: new Request('https://example.com/reset-password?token=abc123'),
		appEnv: testAppEnv,
		title: 'Reset password',
	})

	expect(response.status).toBe(200)
	expect(response.headers.get('Content-Type')).toContain('text/html')
	expect(response.headers.get('Cache-Control')).toBe('no-store')

	const html = await response.text()
	expect(html).toContain('<html')
	expect(html).toContain('Choose a new password')
	expect(html).toContain('New password')
	expect(html).toContain('<!-- rmx:h:')
	expect(html).toContain('<script type="module" src="/client-entry.js">')
	expect(html).not.toContain('loading-spinner')
})

test('renderAppPage preserves 404 state in the server-rendered document', async () => {
	const response = await renderAppPage({
		request: new Request('https://example.com/missing'),
		appEnv: testAppEnv,
		title: 'Not Found',
		notFound: true,
		status: 404,
	})

	expect(response.status).toBe(404)

	const html = await response.text()
	expect(html).toContain('Not Found')
	expect(html).toContain('"notFound":true')
})

test('renderAppPage server-renders account session details', async () => {
	setAuthSessionSecret(testAppEnv.COOKIE_SECRET)
	const setCookie = await createAuthCookie(
		{
			id: '1',
			email: 'signed-in@example.com',
			rememberMe: false,
		},
		true,
	)
	const cookie = setCookie.split(';')[0] ?? ''

	const response = await renderAppPage({
		request: new Request('https://example.com/account', {
			headers: { Cookie: cookie },
		}),
		appEnv: testAppEnv,
		title: 'Account',
	})

	expect(response.status).toBe(200)
	const html = await response.text()
	expect(html).toContain('Welcome, signed-in@example.com')
	expect(html).not.toContain('Loading your account')
})
