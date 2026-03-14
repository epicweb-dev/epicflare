/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { RequestContext } from 'remix/fetch-router'
import {
	createAuthCookie,
	setAuthSessionSecret,
	type AuthSession,
} from '#server/auth-session.ts'
import { createAuthPageHandler } from './auth-page.ts'

const testCookieSecret = 'test-cookie-secret-0123456789abcdef0123456789'
const rememberedSession: AuthSession = {
	id: 'session-id',
	email: 'user@example.com',
	rememberMe: true,
}

function createAuthPageRequestContext(url: string, cookie?: string) {
	return new RequestContext(
		new Request(url, {
			headers: cookie
				? {
						Cookie: cookie,
					}
				: undefined,
		}),
	)
}

async function withMockedNow<T>(now: number, callback: () => Promise<T>) {
	const originalDateNow = Date.now
	Date.now = () => now
	try {
		return await callback()
	} finally {
		Date.now = originalDateNow
	}
}

test('auth page redirects remembered sessions with a refreshed cookie', async () => {
	setAuthSessionSecret(testCookieSecret)
	const now = Date.UTC(2026, 1, 1)
	const cookie = await createAuthCookie(
		rememberedSession,
		false,
		now - 1000 * 60 * 60 * 24 * 15,
	)
	const handler = createAuthPageHandler()

	for (const path of ['/login', '/signup']) {
		const response = await withMockedNow(now, () =>
			handler.action(
				createAuthPageRequestContext(`http://example.com${path}`, cookie),
			),
		)

		expect(response.status).toBe(302)
		expect(response.headers.get('Location')).toBe('http://example.com/account')
		expect(response.headers.get('Set-Cookie')).toContain('epicflare_session=')
		expect(response.headers.get('Set-Cookie')).toContain('Max-Age=2592000')
		expect(() => response.headers.append('X-Test', '1')).not.toThrow()
		expect(response.headers.get('X-Test')).toBe('1')
	}
})
