import { type BuildAction } from 'remix/fetch-router'
import { z } from 'zod'
import type { AppEnv } from '../../types/env-schema.ts'
import { createDb, sql } from '../../worker/db.ts'
import { logAuditEvent, getRequestIp } from '../audit-log.ts'
import { sendResendEmail } from '../email/resend.ts'
import { toHex } from '../hex.ts'
import { normalizeEmail } from '../normalize-email.ts'
import { createPasswordHash } from '../password-hash.ts'
import type routes from '../routes.ts'

const resetTokenBytes = 32
const resetTokenExpiryMs = 60 * 60 * 1000

const resetRequestSchema = z.object({
	email: z.string().min(1),
})

const resetConfirmSchema = z.object({
	token: z.string().min(1),
	password: z.string().min(1),
})

const resetUserSchema = z.object({
	id: z.number(),
	email: z.string(),
})

const resetTokenSchema = z.object({
	id: z.number(),
	user_id: z.number(),
	expires_at: z.number(),
})

function jsonResponse(data: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(data), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers,
		},
	})
}

function buildResetEmail(resetUrl: string) {
	return {
		subject: 'Reset your epicflare password',
		html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Password reset</title>
  </head>
  <body>
    <p>We received a request to reset your epicflare password.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>If you did not request a reset, you can safely ignore this email.</p>
  </body>
</html>`,
	}
}

function generateResetToken() {
	const bytes = new Uint8Array(resetTokenBytes)
	crypto.getRandomValues(bytes)
	return toHex(bytes)
}

async function hashResetToken(token: string) {
	const data = new TextEncoder().encode(token)
	const digest = await crypto.subtle.digest('SHA-256', data)
	return toHex(new Uint8Array(digest))
}

function logMissingEmailConfig(payload: {
	to: string
	from: string
	subject: string
	html: string
}) {
	console.warn(
		'resend-from-email-missing',
		JSON.stringify({
			to: payload.to,
			from: payload.from,
			subject: payload.subject,
			body: payload.html,
		}),
	)
}

export function createPasswordResetRequestHandler(appEnv: AppEnv) {
	const db = createDb(appEnv.APP_DB)

	return {
		middleware: [],
		async action({ request, url }) {
			let body: unknown
			try {
				body = await request.json()
			} catch {
				return jsonResponse({ error: 'Invalid JSON payload.' }, { status: 400 })
			}
			const parsed = resetRequestSchema.safeParse(body)
			const requestIp = getRequestIp(request) ?? undefined
			const normalizedEmail = parsed.success
				? normalizeEmail(parsed.data.email)
				: ''

			if (!parsed.success || !normalizedEmail) {
				void logAuditEvent({
					category: 'auth',
					action: 'password_reset_request',
					result: 'failure',
					email: normalizedEmail || undefined,
					ip: requestIp,
					path: url.pathname,
					reason: 'invalid_payload',
				})
				return jsonResponse({ error: 'Email is required.' }, { status: 400 })
			}

			const userRecord = await db.queryFirst(
				sql`SELECT id, email FROM users WHERE email = ${normalizedEmail}`,
				resetUserSchema,
			)

			if (userRecord) {
				const token = generateResetToken()
				const tokenHash = await hashResetToken(token)
				const expiresAt = Date.now() + resetTokenExpiryMs
				const resetUrl = new URL('/reset-password', request.url)
				resetUrl.searchParams.set('token', token)
				const email = buildResetEmail(resetUrl.toString())
				const fromEmail = appEnv.RESEND_FROM_EMAIL?.trim() ?? ''

				await db.exec(
					sql`DELETE FROM password_resets WHERE user_id = ${userRecord.id}`,
				)
				await db.exec(
					sql`
						INSERT INTO password_resets (user_id, token_hash, expires_at)
						VALUES (${userRecord.id}, ${tokenHash}, ${expiresAt})
					`,
				)

				if (!fromEmail) {
					logMissingEmailConfig({
						to: normalizedEmail,
						from: fromEmail,
						subject: email.subject,
						html: email.html,
					})
				} else {
					try {
						const apiBaseUrl =
							appEnv.RESEND_API_BASE_URL ?? 'https://api.resend.com'
						await sendResendEmail(
							{
								apiBaseUrl,
								apiKey: appEnv.RESEND_API_KEY,
							},
							{
								to: normalizedEmail,
								from: fromEmail,
								subject: email.subject,
								html: email.html,
							},
						)
					} catch (error) {
						console.warn('resend-email-error', error)
					}
				}

				void logAuditEvent({
					category: 'auth',
					action: 'password_reset_request',
					result: 'success',
					email: normalizedEmail,
					ip: requestIp,
					path: url.pathname,
				})
			} else {
				void logAuditEvent({
					category: 'auth',
					action: 'password_reset_request',
					result: 'failure',
					email: normalizedEmail,
					ip: requestIp,
					path: url.pathname,
					reason: 'email_not_found',
				})
			}

			return jsonResponse({
				ok: true,
				message: 'If the account exists, a reset email has been sent.',
			})
		},
	} satisfies BuildAction<
		typeof routes.passwordResetRequest.method,
		typeof routes.passwordResetRequest.pattern
	>
}

export function createPasswordResetConfirmHandler(appEnv: AppEnv) {
	const db = createDb(appEnv.APP_DB)

	return {
		middleware: [],
		async action({ request, url }) {
			let body: unknown
			try {
				body = await request.json()
			} catch {
				return jsonResponse({ error: 'Invalid JSON payload.' }, { status: 400 })
			}
			const parsed = resetConfirmSchema.safeParse(body)
			const requestIp = getRequestIp(request) ?? undefined
			const token = parsed.success ? parsed.data.token.trim() : ''
			const password = parsed.success ? parsed.data.password : ''

			if (!parsed.success || !token || !password) {
				void logAuditEvent({
					category: 'auth',
					action: 'password_reset_confirm',
					result: 'failure',
					ip: requestIp,
					path: url.pathname,
					reason: 'invalid_payload',
				})
				return jsonResponse(
					{ error: 'Token and password are required.' },
					{ status: 400 },
				)
			}

			const tokenHash = await hashResetToken(token)
			const resetRecord = await db.queryFirst(
				sql`SELECT id, user_id, expires_at FROM password_resets WHERE token_hash = ${tokenHash}`,
				resetTokenSchema,
			)
			const now = Date.now()

			if (!resetRecord || resetRecord.expires_at < now) {
				if (resetRecord && resetRecord.expires_at < now) {
					await db.exec(
						sql`DELETE FROM password_resets WHERE id = ${resetRecord.id}`,
					)
				}
				void logAuditEvent({
					category: 'auth',
					action: 'password_reset_confirm',
					result: 'failure',
					ip: requestIp,
					path: url.pathname,
					reason: resetRecord ? 'expired_token' : 'invalid_token',
				})
				return jsonResponse(
					{ error: 'Reset link is invalid or expired.' },
					{ status: 400 },
				)
			}

			const passwordHash = await createPasswordHash(password)
			await db.exec(
				sql`
					UPDATE users
					SET password_hash = ${passwordHash}, updated_at = CURRENT_TIMESTAMP
					WHERE id = ${resetRecord.user_id}
				`,
			)
			await db.exec(
				sql`DELETE FROM password_resets WHERE user_id = ${resetRecord.user_id}`,
			)

			void logAuditEvent({
				category: 'auth',
				action: 'password_reset_confirm',
				result: 'success',
				ip: requestIp,
				path: url.pathname,
			})

			return jsonResponse({ ok: true })
		},
	} satisfies BuildAction<
		typeof routes.passwordResetConfirm.method,
		typeof routes.passwordResetConfirm.pattern
	>
}
