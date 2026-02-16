/// <reference types="bun" />
import { beforeAll, expect, test } from 'bun:test'
import { RequestContext } from 'remix/fetch-router'
import { setAuthSessionSecret } from '#server/auth-session.ts'
import { createPasswordHash } from '#server/password-hash.ts'
import { createDb, sql } from '#src/db/client.ts'
import { createAuthHandler } from './auth.ts'
import { z } from 'zod'

const testCookieSecret = 'test-cookie-secret-0123456789abcdef0123456789'

function createAuthRequest(
	body: unknown,
	url: string,
	handler: ReturnType<typeof createAuthHandler>,
) {
	const request = new Request(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	})
	const context = new RequestContext(request)

	return {
		run: () => handler.action(context),
	}
}

type TestUser = {
	email: string
	password_hash: string
}

function createTestEnv() {
	const databaseId = crypto.randomUUID()
	return {
		COOKIE_SECRET: testCookieSecret,
		// Use a named in-memory database so multiple connections share state.
		DATABASE_URL: `sqlite:file:auth-handler-${databaseId}?mode=memory&cache=shared`,
	}
}

const userLookupSchema = z.object({
	id: z.number(),
	email: z.string(),
	password_hash: z.string(),
})

async function insertUser(
	env: ReturnType<typeof createTestEnv>,
	user: {
		email: string
		password: string
	},
) {
	const db = createDb(env)
	const passwordHash = await createPasswordHash(user.password)
	await db.exec(
		sql`INSERT INTO users (username, email, password_hash) VALUES (${user.email}, ${user.email}, ${passwordHash});`,
	)
	return {
		email: user.email,
		password_hash: passwordHash,
	} satisfies TestUser
}

beforeAll(() => {
	setAuthSessionSecret(testCookieSecret)
})

test('auth handler returns 400 for invalid JSON', async () => {
	const env = createTestEnv()
	const handler = createAuthHandler({
		...env,
	})
	const authRequest = createAuthRequest('{', 'http://example.com/auth', handler)
	const response = await authRequest.run()
	expect(response.status).toBe(400)
	const payload = await response.json()
	expect(payload).toEqual({ error: 'Invalid JSON payload.' })
})

test('auth handler returns 400 for missing fields', async () => {
	const env = createTestEnv()
	const handler = createAuthHandler(env)
	const authRequest = createAuthRequest(
		{ email: 'a@b.com' },
		'http://example.com/auth',
		handler,
	)
	const response = await authRequest.run()
	expect(response.status).toBe(400)
	const payload = await response.json()
	expect(payload).toEqual({
		error: 'Email, password, and mode are required.',
	})
})

test('auth handler rejects login with unknown user', async () => {
	const env = createTestEnv()
	const handler = createAuthHandler(env)
	const authRequest = createAuthRequest(
		{ email: 'a@b.com', password: 'secret', mode: 'login' },
		'http://example.com/auth',
		handler,
	)
	const response = await authRequest.run()
	expect(response.status).toBe(401)
	const payload = await response.json()
	expect(payload).toEqual({ error: 'Invalid email or password.' })
})

test('auth handler creates a user and cookie for signup', async () => {
	const env = createTestEnv()
	const handler = createAuthHandler(env)
	const authRequest = createAuthRequest(
		{ email: 'new@b.com', password: 'secret', mode: 'signup' },
		'http://example.com/auth',
		handler,
	)
	const response = await authRequest.run()
	expect(response.status).toBe(200)
	const payload = await response.json()
	expect(payload).toEqual({ ok: true, mode: 'signup' })
	const db = createDb(env)
	const user = await db.queryFirst(
		sql`SELECT id, email, password_hash FROM users WHERE email = ${'new@b.com'}`,
		userLookupSchema,
	)
	expect(user?.email).toBe('new@b.com')
	const setCookie = response.headers.get('Set-Cookie') ?? ''
	expect(setCookie).toContain('epicflare_session=')
})

test('auth handler returns ok with a session cookie for login', async () => {
	const env = createTestEnv()
	const handler = createAuthHandler(env)
	await insertUser(env, { email: 'a@b.com', password: 'secret' })
	const authRequest = createAuthRequest(
		{ email: 'a@b.com', password: 'secret', mode: 'login' },
		'http://example.com/auth',
		handler,
	)
	const response = await authRequest.run()
	expect(response.status).toBe(200)
	const payload = await response.json()
	expect(payload).toEqual({ ok: true, mode: 'login' })
	const setCookie = response.headers.get('Set-Cookie') ?? ''
	expect(setCookie).toContain('epicflare_session=')
})

test('auth handler sets Secure cookie over https', async () => {
	const env = createTestEnv()
	const handler = createAuthHandler(env)
	await insertUser(env, { email: 'secure@b.com', password: 'secret' })
	const authRequest = createAuthRequest(
		{ email: 'secure@b.com', password: 'secret', mode: 'login' },
		'https://example.com/auth',
		handler,
	)
	const response = await authRequest.run()
	const setCookie = response.headers.get('Set-Cookie') ?? ''
	expect(setCookie).toContain('Secure')
})
