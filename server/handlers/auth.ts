import { type BuildAction } from 'remix/fetch-router'
import { z } from 'zod'
import { createDb, sql } from '../../worker/db.ts'
import { createAuthCookie } from '../auth-session.ts'
import { getAppDb } from '../app-env.ts'
import { createPasswordHash, verifyPassword } from '../password-hash.ts'
import type routes from '../routes.ts'

type AuthMode = 'login' | 'signup'

function isAuthMode(value: string): value is AuthMode {
	return value === 'login' || value === 'signup'
}

function jsonResponse(data: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(data), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers,
		},
	})
}

const userIdSchema = z.object({ id: z.number() })
const userPasswordSchema = z.object({ password_hash: z.string() })

export default {
	middleware: [],
	async action({ request, url }) {
		let body: unknown

		try {
			body = await request.json()
		} catch {
			return jsonResponse({ error: 'Invalid JSON payload.' }, { status: 400 })
		}

		if (!body || typeof body !== 'object') {
			return jsonResponse({ error: 'Invalid request body.' }, { status: 400 })
		}

		const { email, password, mode } = body as Record<string, unknown>
		const normalizedEmail =
			typeof email === 'string' ? email.trim().toLowerCase() : ''
		const normalizedPassword = typeof password === 'string' ? password : ''
		const normalizedMode =
			typeof mode === 'string' && isAuthMode(mode) ? mode : null

		if (!normalizedEmail || !normalizedPassword || !normalizedMode) {
			return jsonResponse(
				{ error: 'Email, password, and mode are required.' },
				{ status: 400 },
			)
		}

		const db = createDb(getAppDb())

		if (normalizedMode === 'signup') {
			const existingUser = await db.queryFirst(
				sql`SELECT id FROM users WHERE email = ${normalizedEmail}`,
				userIdSchema,
			)
			if (existingUser) {
				return jsonResponse(
					{ error: 'Email already in use.' },
					{ status: 409 },
				)
			}
			const passwordHash = await createPasswordHash(normalizedPassword)
			try {
				await db.exec(
					sql`INSERT INTO users (username, email, password_hash) VALUES (${normalizedEmail}, ${normalizedEmail}, ${passwordHash})`,
				)
			} catch {
				return jsonResponse(
					{ error: 'Unable to create account.' },
					{ status: 500 },
				)
			}
		}

		if (normalizedMode === 'login') {
			const userRecord = await db.queryFirst(
				sql`SELECT password_hash FROM users WHERE email = ${normalizedEmail}`,
				userPasswordSchema,
			)
			const passwordCheck = userRecord
				? await verifyPassword(normalizedPassword, userRecord.password_hash)
				: null
			if (!userRecord || !passwordCheck?.valid) {
				return jsonResponse(
					{ error: 'Invalid email or password.' },
					{ status: 401 },
				)
			}
			if (passwordCheck.upgradedHash) {
				try {
					await db.exec(
						sql`UPDATE users SET password_hash = ${passwordCheck.upgradedHash} WHERE email = ${normalizedEmail}`,
					)
				} catch {
					// Ignore upgrade failures so valid logins still succeed.
				}
			}
		}

		const cookie = await createAuthCookie(
			{
				id: crypto.randomUUID(),
				email: normalizedEmail,
			},
			url.protocol === 'https:',
		)

		return jsonResponse(
			{ ok: true, mode: normalizedMode },
			{
				headers: {
					'Set-Cookie': cookie,
				},
			},
		)
	},
} satisfies BuildAction<typeof routes.auth.method, typeof routes.auth.pattern>
