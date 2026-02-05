/// <reference types="bun" />
import { beforeAll, expect, test } from 'bun:test'
import { RequestContext } from 'remix/fetch-router'
import { setAuthSessionSecret } from '../auth-session.ts'
import auth from './auth.ts'

function createAuthRequest(body: unknown, url: string) {
	const request = new Request(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	})
	const context = new RequestContext(request)

	return {
		run: () => auth.action(context),
	}
}

beforeAll(() => {
	setAuthSessionSecret('test-cookie-secret')
})

test('auth handler returns 400 for invalid JSON', async () => {
	const authRequest = createAuthRequest('{', 'http://example.com/auth')
	const response = await authRequest.run()
	expect(response.status).toBe(400)
	const payload = await response.json()
	expect(payload).toEqual({ error: 'Invalid JSON payload.' })
})

test('auth handler returns 400 for missing fields', async () => {
	const authRequest = createAuthRequest(
		{ email: 'a@b.com' },
		'http://example.com/auth',
	)
	const response = await authRequest.run()
	expect(response.status).toBe(400)
	const payload = await response.json()
	expect(payload).toEqual({
		error: 'Email, password, and mode are required.',
	})
})

test('auth handler returns ok with a session cookie for login', async () => {
	const authRequest = createAuthRequest(
		{ email: 'a@b.com', password: 'secret', mode: 'login' },
		'http://example.com/auth',
	)
	const response = await authRequest.run()
	expect(response.status).toBe(200)
	const payload = await response.json()
	expect(payload).toEqual({ ok: true, mode: 'login' })
	const setCookie = response.headers.get('Set-Cookie') ?? ''
	expect(setCookie).toContain('epicflare_session=')
})

test('auth handler sets Secure cookie over https', async () => {
	const authRequest = createAuthRequest(
		{ email: 'a@b.com', password: 'secret', mode: 'signup' },
		'https://example.com/auth',
	)
	const response = await authRequest.run()
	const setCookie = response.headers.get('Set-Cookie') ?? ''
	expect(setCookie).toContain('Secure')
})
