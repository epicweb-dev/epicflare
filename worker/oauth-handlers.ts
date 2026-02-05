import type {
	AuthRequest,
	OAuthHelpers,
} from '@cloudflare/workers-oauth-provider'
import { z } from 'zod'
import { Layout } from '../server/layout.ts'
import { render } from '../server/render.ts'
import { createDb, sql } from './db.ts'

export const oauthPaths = {
	authorize: '/oauth/authorize',
	authorizeInfo: '/oauth/authorize-info',
	token: '/oauth/token',
	register: '/oauth/register',
	callback: '/oauth/callback',
	apiPrefix: '/api/',
}

export const oauthScopes: Array<string> = ['profile', 'email']

type OAuthProps = {
	userId: string
	email: string
	displayName: string
}

type OAuthEnv = Env & {
	OAUTH_PROVIDER: OAuthHelpers
}

type OAuthContext = ExecutionContext & {
	props?: OAuthProps
}

function renderSpaShell(status = 200) {
	return render(Layout({}), { status })
}

const passwordHashPrefix = 'pbkdf2_sha256'
const passwordSaltBytes = 16
const passwordHashBytes = 32
const passwordHashIterations = 120_000
const legacyPasswordHashPattern = /^[0-9a-f]{64}$/i
const userRecordSchema = z.object({ password_hash: z.string() })

function toHex(bytes: Uint8Array) {
	return Array.from(bytes)
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('')
}

function fromHex(value: string) {
	const normalized = value.trim().toLowerCase()
	if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
		return null
	}
	const bytes = new Uint8Array(normalized.length / 2)
	for (let index = 0; index < normalized.length; index += 2) {
		const byte = Number.parseInt(normalized.slice(index, index + 2), 16)
		if (Number.isNaN(byte)) return null
		bytes[index / 2] = byte
	}
	return bytes
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
	if (left.length !== right.length) return false
	let result = 0
	for (let index = 0; index < left.length; index += 1) {
		result |= left[index] ^ right[index]
	}
	return result === 0
}

async function createUserId(email: string) {
	const normalized = email.trim().toLowerCase()
	const data = new TextEncoder().encode(normalized)
	const hash = await crypto.subtle.digest('SHA-256', data)
	return toHex(new Uint8Array(hash))
}

async function derivePasswordKey(
	password: string,
	salt: Uint8Array,
	iterations: number,
	length: number,
) {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	)
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt,
			iterations,
			hash: 'SHA-256',
		},
		key,
		length * 8,
	)
	return new Uint8Array(derivedBits)
}

async function createPasswordHash(password: string) {
	const salt = crypto.getRandomValues(new Uint8Array(passwordSaltBytes))
	const hash = await derivePasswordKey(
		password,
		salt,
		passwordHashIterations,
		passwordHashBytes,
	)
	return `${passwordHashPrefix}$${passwordHashIterations}$${toHex(salt)}$${toHex(
		hash,
	)}`
}

async function hashLegacyPassword(password: string) {
	const data = new TextEncoder().encode(password)
	const hash = await crypto.subtle.digest('SHA-256', data)
	return toHex(new Uint8Array(hash))
}

async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<{ valid: boolean; upgradedHash?: string }> => {
	if (!storedHash) {
		return { valid: false }
	}
	const normalizedHash = storedHash.trim()
	if (normalizedHash.startsWith(`${passwordHashPrefix}$`)) {
		const [prefix, iterationsRaw, saltHex, hashHex, ...extra] =
			normalizedHash.split('$')
		if (prefix !== passwordHashPrefix || extra.length > 0) {
			return { valid: false }
		}
		const iterations = Number.parseInt(iterationsRaw, 10)
		const salt = saltHex ? fromHex(saltHex) : null
		const hash = hashHex ? fromHex(hashHex) : null
		if (!iterations || iterations < 1 || !salt || !hash) {
			return { valid: false }
		}
		const derived = await derivePasswordKey(
			password,
			salt,
			iterations,
			hash.length,
		)
		return { valid: timingSafeEqual(derived, hash) }
	}

	if (legacyPasswordHashPattern.test(normalizedHash)) {
		const legacyHash = await hashLegacyPassword(password)
		const valid = timingSafeEqual(
			new TextEncoder().encode(legacyHash),
			new TextEncoder().encode(normalizedHash.toLowerCase()),
		)
		if (valid) {
			return { valid: true, upgradedHash: await createPasswordHash(password) }
		}
	}

	return { valid: false }
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

function getOAuthHelpers(env: Env) {
	const helpers = (env as OAuthEnv).OAUTH_PROVIDER
	if (!helpers) {
		throw new Error('OAuth provider helpers are not available.')
	}
	return helpers
}

async function resolveAuthRequest(helpers: OAuthHelpers, request: Request) {
	try {
		const authRequest = await helpers.parseAuthRequest(request)
		if (!authRequest.clientId || !authRequest.redirectUri) {
			return {
				error:
					'Invalid OAuth request. Client ID and redirect URI are required.',
			}
		}
		const client = await helpers.lookupClient(authRequest.clientId)
		if (!client) {
			return { error: 'Unknown OAuth client.' }
		}
		return { authRequest, client }
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unable to parse OAuth request.'
		return { error: message }
	}
}

function resolveScopes(requestedScopes: Array<string>) {
	if (requestedScopes.length === 0) return oauthScopes
	const invalidScopes = requestedScopes.filter(
		(scope) => !oauthScopes.includes(scope),
	)
	if (invalidScopes.length > 0) {
		return {
			error: `Unsupported scopes requested: ${invalidScopes.join(', ')}`,
		}
	}
	return requestedScopes
}

function createAccessDeniedRedirectUrl(request: AuthRequest) {
	if (!request.redirectUri) {
		return null
	}
	const redirectUrl = new URL(request.redirectUri)
	redirectUrl.searchParams.set('error', 'access_denied')
	if (request.state) redirectUrl.searchParams.set('state', request.state)
	return redirectUrl.toString()
}

function wantsJson(request: Request) {
	return request.headers.get('Accept')?.includes('application/json') ?? false
}

function createAuthorizeErrorRedirect(
	request: Request,
	error: string,
	description: string,
) {
	const redirectUrl = new URL(request.url)
	redirectUrl.searchParams.set('error', error)
	redirectUrl.searchParams.set('error_description', description)
	return Response.redirect(redirectUrl.toString(), 303)
}

function respondAuthorizeError(
	request: Request,
	message: string,
	status = 400,
	errorCode = 'invalid_request',
) {
	return wantsJson(request)
		? jsonResponse(
				{ ok: false, error: message, code: errorCode },
				{ status },
			)
		: createAuthorizeErrorRedirect(request, errorCode, message)
}

export async function handleAuthorizeInfo(
	request: Request,
	env: Env,
): Promise<Response> {
	const helpers = getOAuthHelpers(env)
	const resolution = await resolveAuthRequest(helpers, request)
	if ('error' in resolution) {
		return jsonResponse({ ok: false, error: resolution.error }, { status: 400 })
	}

	const { authRequest, client } = resolution
	const resolvedScopes = resolveScopes(authRequest.scope)
	if (!Array.isArray(resolvedScopes)) {
		return jsonResponse(
			{ ok: false, error: resolvedScopes.error },
			{ status: 400 },
		)
	}

	return jsonResponse({
		ok: true,
		client: {
			id: client.clientId,
			name: client.clientName ?? client.clientId,
		},
		scopes: resolvedScopes,
	})
}

export async function handleAuthorizeRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	if (request.method === 'GET') {
		return renderSpaShell()
	}

	if (request.method !== 'POST') {
		return new Response('Method not allowed', { status: 405 })
	}

	const helpers = getOAuthHelpers(env)
	const resolution = await resolveAuthRequest(helpers, request)
	if ('error' in resolution) {
		return respondAuthorizeError(request, resolution.error)
	}

	const { authRequest } = resolution
	const formData = await request.formData()
	const decision = String(formData.get('decision') ?? 'approve')
	if (decision === 'deny') {
		const redirectTo = createAccessDeniedRedirectUrl(authRequest)
		if (!redirectTo) {
			return respondAuthorizeError(
				request,
				'Missing redirect URI for access denial.',
			)
		}
		return wantsJson(request)
			? jsonResponse({ ok: true, redirectTo })
			: Response.redirect(redirectTo, 302)
	}

	const email = String(formData.get('email') ?? '').trim()
	const password = String(formData.get('password') ?? '')
	const normalizedEmail = email.toLowerCase()

	if (!email || !password) {
		return respondAuthorizeError(request, 'Email and password are required.')
	}

	const db = createDb(env.APP_DB)
	const userRecord = await db.queryFirst(
		sql`SELECT password_hash FROM users WHERE email = ${normalizedEmail}`,
		userRecordSchema,
	)
	const passwordCheck = userRecord
		? await verifyPassword(password, userRecord.password_hash)
		: null

	if (!userRecord || !passwordCheck?.valid) {
		return respondAuthorizeError(request, 'Invalid email or password.')
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

	const resolvedScopes = resolveScopes(authRequest.scope)
	if (Array.isArray(resolvedScopes)) {
		const userId = await createUserId(normalizedEmail)
		const displayName = normalizedEmail.split('@')[0] || 'user'
		const { redirectTo } = await helpers.completeAuthorization({
			request: authRequest,
			userId,
			metadata: {
				email: normalizedEmail,
				clientId: authRequest.clientId,
			},
			scope: resolvedScopes,
			props: {
				userId,
				email: normalizedEmail,
				displayName,
			},
		})
		return wantsJson(request)
			? jsonResponse({ ok: true, redirectTo })
			: Response.redirect(redirectTo, 302)
	}

	return respondAuthorizeError(request, resolvedScopes.error)
}

export function handleOAuthCallback(request: Request): Response {
	const url = new URL(request.url)
	const hasError =
		url.searchParams.has('error') || url.searchParams.has('error_description')
	return renderSpaShell(hasError ? 400 : 200)
}

export const apiHandler = {
	async fetch(request: Request, _env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url)
		if (url.pathname === '/api/me') {
			const props = (ctx as OAuthContext).props
			if (!props) {
				return jsonResponse(
					{ ok: false, error: 'Unauthorized' },
					{ status: 401 },
				)
			}
			return jsonResponse({ ok: true, user: props })
		}

		return jsonResponse({ error: 'Not found' }, { status: 404 })
	},
} satisfies ExportedHandler
