import { type BuildAction } from 'remix/fetch-router'
import { object, parseSafe, string } from 'remix/data-schema'
import { z } from 'zod'
import { type AppEnv } from '#types/env-schema.ts'
import { createDb, sql } from '#worker/db.ts'
import { logAuditEvent, getRequestIp } from '#server/audit-log.ts'
import { sendResendEmail } from '#server/email/resend.ts'
import { toHex } from '#server/hex.ts'
import { normalizeEmail } from '#server/normalize-email.ts'
import { createPasswordHash } from '#server/password-hash.ts'
import type routes from '#server/routes.ts'

const resetTokenBytes = 32
const resetTokenExpiryMs = 60 * 60 * 1000

const resetRequestSchema = object({
	email: string(),
})

const resetConfirmSchema = object({
	token: string(),
	password: string(),
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
				return Response.json(
					{ error: 'Invalid JSON payload.' },
					{ status: 400 },
				)
			}
			const parsed = parseSafe(resetRequestSchema, body)
			const requestIp = getRequestIp(request) ?? undefined
			const normalizedEmail = parsed.success
				? normalizeEmail(parsed.value.email)
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
				return Response.json({ error: 'Email is required.' }, { status: 400 })
			}

			const userRecord = await db.queryFirst(
				sql`SELECT id, email FROM users WHERE email = ${normalizedEmail}`,
				resetUserSchema,
			)

			const token = generateResetToken()
			const tokenHash = await hashResetToken(token)
			const expiresAt = Date.now() + resetTokenExpiryMs

			await db.exec(
				sql`
					DELETE FROM password_resets
					WHERE user_id = (SELECT id FROM users WHERE email = ${normalizedEmail})
				`,
			)
			await db.exec(
				sql`
					INSERT INTO password_resets (user_id, token_hash, expires_at)
					SELECT id, ${tokenHash}, ${expiresAt}
					FROM users
					WHERE email = ${normalizedEmail}
				`,
			)

			if (userRecord) {
				const appBaseUrl = appEnv.APP_BASE_URL ?? url.origin
				const resetUrl = new URL('/reset-password', appBaseUrl)
				resetUrl.searchParams.set('token', token)
				const email = buildResetEmail(resetUrl.toString())
				const fromEmail = appEnv.RESEND_FROM_EMAIL?.trim() ?? ''

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

			return Response.json({
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
				return Response.json(
					{ error: 'Invalid JSON payload.' },
					{ status: 400 },
				)
			}
			const parsed = parseSafe(resetConfirmSchema, body)
			const requestIp = getRequestIp(request) ?? undefined
			const token = parsed.success ? parsed.value.token.trim() : ''
			const password = parsed.success ? parsed.value.password : ''

			if (!parsed.success || !token || !password) {
				void logAuditEvent({
					category: 'auth',
					action: 'password_reset_confirm',
					result: 'failure',
					ip: requestIp,
					path: url.pathname,
					reason: 'invalid_payload',
				})
				return Response.json(
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
				return Response.json(
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

			return Response.json({ ok: true })
		},
	} satisfies BuildAction<
		typeof routes.passwordResetConfirm.method,
		typeof routes.passwordResetConfirm.pattern
	>
}
