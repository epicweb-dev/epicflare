/// <reference types="bun" />
import { beforeAll, beforeEach, expect, test } from 'bun:test'
import { RequestContext } from 'remix/fetch-router'
import { setAppDb } from '../app-env.ts'
import { setAuthSessionSecret } from '../auth-session.ts'
import { createPasswordHash } from '../password-hash.ts'
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

type TestUser = {
	id: number
	email: string
	username: string
	password_hash: string
}

function createTestDb() {
	let nextId = 1
	const users = new Map<string, TestUser>()
	const db = {
		prepare(query: string) {
			return {
				bind(...params: Array<unknown>) {
					const normalizedQuery = query
						.replace(/\s+/g, ' ')
						.trim()
						.toLowerCase()
					return {
						async first() {
							if (normalizedQuery.startsWith('select id from users')) {
								const email = String(params[0] ?? '').toLowerCase()
								const user = users.get(email)
								return user ? { id: user.id } : null
							}
							if (
								normalizedQuery.startsWith(
									'select password_hash from users where email = ?',
								)
							) {
								const email = String(params[0] ?? '').toLowerCase()
								const user = users.get(email)
								return user ? { password_hash: user.password_hash } : null
							}
							return null
						},
						async run() {
							if (normalizedQuery.startsWith('insert into users')) {
								const [username, email, passwordHash] = params as Array<string>
								const normalizedEmail = String(email).toLowerCase()
								if (users.has(normalizedEmail)) {
									throw new Error('UNIQUE constraint failed: users.email')
								}
								const user: TestUser = {
									id: nextId,
									email: String(email),
									username: String(username),
									password_hash: String(passwordHash),
								}
								nextId += 1
								users.set(normalizedEmail, user)
								return { success: true }
							}
							if (
								normalizedQuery.startsWith(
									'update users set password_hash = ? where email = ?',
								)
							) {
								const [passwordHash, email] = params as Array<string>
								const user = users.get(String(email).toLowerCase())
								if (user) {
									user.password_hash = String(passwordHash)
								}
								return { success: true }
							}
							return { success: true }
						},
					}
				},
			}
		},
	} as unknown as D1Database

	async function addUser(email: string, password: string) {
		const passwordHash = await createPasswordHash(password)
		const user: TestUser = {
			id: nextId,
			email,
			username: email,
			password_hash: passwordHash,
		}
		nextId += 1
		users.set(email.toLowerCase(), user)
		return user
	}

	return { db, users, addUser }
}

let testDb: ReturnType<typeof createTestDb>

beforeAll(() => {
	setAuthSessionSecret('test-cookie-secret')
})

beforeEach(() => {
	testDb = createTestDb()
	setAppDb(testDb.db)
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

test('auth handler rejects login with unknown user', async () => {
	const authRequest = createAuthRequest(
		{ email: 'a@b.com', password: 'secret', mode: 'login' },
		'http://example.com/auth',
	)
	const response = await authRequest.run()
	expect(response.status).toBe(401)
	const payload = await response.json()
	expect(payload).toEqual({ error: 'Invalid email or password.' })
})

test('auth handler creates a user and cookie for signup', async () => {
	const authRequest = createAuthRequest(
		{ email: 'new@b.com', password: 'secret', mode: 'signup' },
		'http://example.com/auth',
	)
	const response = await authRequest.run()
	expect(response.status).toBe(200)
	const payload = await response.json()
	expect(payload).toEqual({ ok: true, mode: 'signup' })
	expect(testDb.users.has('new@b.com')).toBe(true)
	const setCookie = response.headers.get('Set-Cookie') ?? ''
	expect(setCookie).toContain('epicflare_session=')
})

test('auth handler returns ok with a session cookie for login', async () => {
	await testDb.addUser('a@b.com', 'secret')
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
