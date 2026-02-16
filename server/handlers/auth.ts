import { type BuildAction } from 'remix/fetch-router'
import { z } from 'zod'
import { createAuthCookie } from '#server/auth-session.ts'
import { getRequestIp, logAuditEvent } from '#server/audit-log.ts'
import { normalizeEmail } from '#server/normalize-email.ts'
import { createPasswordHash, verifyPassword } from '#server/password-hash.ts'
import { type AppEnv } from '#types/env-schema.ts'
import { createDb, sql } from '#src/db/client.ts'
import type routes from '#server/routes.ts'

type AuthMode = 'login' | 'signup'

function isAuthMode(value: string): value is AuthMode {
	return value === 'login' || value === 'signup'
}

function isUniqueConstraintError(error: unknown) {
	if (
		error instanceof Error &&
		/unique constraint failed/i.test(error.message)
	) {
		return true
	}
	if (
		error instanceof Error &&
		/duplicate key value violates unique constraint/i.test(error.message)
	) {
		return true
	}
	if (error && typeof error === 'object' && 'code' in error) {
		return (error as { code?: unknown }).code === '23505'
	}
	return false
}

const userLookupSchema = z.object({ id: z.number(), password_hash: z.string() })
const userIdSchema = z.object({ id: z.number() })
const dummyPasswordHash =
	'pbkdf2_sha256$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000'

export function createAuthHandler(appEnv: AppEnv) {
	const db = createDb(appEnv)

	return {
		middleware: [],
		async action({ request, url }) {
			let body: unknown

			try {
				body = await request.json()
			} catch {
				return Response.json(
					{ error: 'Invalid JSON payload.' },
					{ status: 400 },
				)
			}

			if (!body || typeof body !== 'object') {
				return Response.json(
					{ error: 'Invalid request body.' },
					{ status: 400 },
				)
			}

			const { email, password, mode } = body as Record<string, unknown>
			const normalizedEmail =
				typeof email === 'string' ? normalizeEmail(email) : ''
			const normalizedPassword = typeof password === 'string' ? password : ''
			const normalizedMode =
				typeof mode === 'string' && isAuthMode(mode) ? mode : null
			const requestIp = getRequestIp(request) ?? undefined

			if (!normalizedEmail || !normalizedPassword || !normalizedMode) {
				void logAuditEvent({
					category: 'auth',
					action: 'authenticate',
					result: 'failure',
					email: normalizedEmail || undefined,
					ip: requestIp,
					path: url.pathname,
					reason: 'missing_fields',
				})
				return Response.json(
					{ error: 'Email, password, and mode are required.' },
					{ status: 400 },
				)
			}

			if (normalizedMode === 'signup') {
				const existingUser = await db.queryFirst(
					sql`SELECT id FROM users WHERE email = ${normalizedEmail}`,
					userIdSchema,
				)
				if (existingUser) {
					void logAuditEvent({
						category: 'auth',
						action: 'signup',
						result: 'failure',
						email: normalizedEmail,
						ip: requestIp,
						path: url.pathname,
						reason: 'email_exists',
					})
					return Response.json(
						{ error: 'Email already registered.' },
						{ status: 409 },
					)
				}

				const passwordHash = await createPasswordHash(normalizedPassword)
				const username = normalizedEmail
				let record: { id: number } | null = null
				try {
					record = await db.queryFirst(
						sql`
							INSERT INTO users (username, email, password_hash)
							VALUES (${username}, ${normalizedEmail}, ${passwordHash})
							RETURNING id
						`,
						userIdSchema,
					)
				} catch (error) {
					if (isUniqueConstraintError(error)) {
						void logAuditEvent({
							category: 'auth',
							action: 'signup',
							result: 'failure',
							email: normalizedEmail,
							ip: requestIp,
							path: url.pathname,
							reason: 'email_exists',
						})
						return Response.json(
							{ error: 'Email already registered.' },
							{ status: 409 },
						)
					}
					throw error
				}
				if (!record) {
					void logAuditEvent({
						category: 'auth',
						action: 'signup',
						result: 'failure',
						email: normalizedEmail,
						ip: requestIp,
						path: url.pathname,
						reason: 'insert_failed',
					})
					return Response.json(
						{ error: 'Unable to create account.' },
						{ status: 500 },
					)
				}

				const cookie = await createAuthCookie(
					{ id: String(record.id), email: normalizedEmail },
					url.protocol === 'https:',
				)
				void logAuditEvent({
					category: 'auth',
					action: 'signup',
					result: 'success',
					email: normalizedEmail,
					ip: requestIp,
					path: url.pathname,
				})
				return Response.json(
					{ ok: true, mode: normalizedMode },
					{
						headers: {
							'Set-Cookie': cookie,
						},
					},
				)
			}

			const userRecord = await db.queryFirst(
				sql`SELECT id, password_hash FROM users WHERE email = ${normalizedEmail}`,
				userLookupSchema,
			)
			let passwordCheck: Awaited<ReturnType<typeof verifyPassword>> | null =
				null
			if (userRecord) {
				passwordCheck = await verifyPassword(
					normalizedPassword,
					userRecord.password_hash,
				)
			} else {
				await verifyPassword(normalizedPassword, dummyPasswordHash)
			}
			if (!userRecord || !passwordCheck?.valid) {
				void logAuditEvent({
					category: 'auth',
					action: 'login',
					result: 'failure',
					email: normalizedEmail,
					ip: requestIp,
					path: url.pathname,
					reason: 'invalid_credentials',
				})
				return Response.json(
					{ error: 'Invalid email or password.' },
					{ status: 401 },
				)
			}

			if (passwordCheck.upgradedHash) {
				try {
					await db.exec(
						sql`UPDATE users SET password_hash = ${passwordCheck.upgradedHash} WHERE id = ${userRecord.id}`,
					)
				} catch {
					// Ignore upgrade failures so valid logins still succeed.
				}
			}

			const cookie = await createAuthCookie(
				{
					id: String(userRecord.id),
					email: normalizedEmail,
				},
				url.protocol === 'https:',
			)
			void logAuditEvent({
				category: 'auth',
				action: 'login',
				result: 'success',
				email: normalizedEmail,
				ip: requestIp,
				path: url.pathname,
			})
			return Response.json(
				{ ok: true, mode: normalizedMode },
				{
					headers: {
						'Set-Cookie': cookie,
					},
				},
			)
		},
	} satisfies BuildAction<typeof routes.auth.method, typeof routes.auth.pattern>
}
