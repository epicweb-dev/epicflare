/// <reference types="bun" />
import { expect, test } from 'bun:test'
import type {
	AuthRequest,
	ClientInfo,
	CompleteAuthorizationOptions,
	OAuthHelpers,
} from '@cloudflare/workers-oauth-provider'
import {
	handleAuthorizeInfo,
	handleAuthorizeRequest,
	handleOAuthCallback,
	oauthScopes,
} from './oauth-handlers.ts'

const baseAuthRequest: AuthRequest = {
	responseType: 'code',
	clientId: 'client-123',
	redirectUri: 'https://example.com/callback',
	scope: ['profile'],
	state: 'demo',
}

const baseClient: ClientInfo = {
	clientId: 'client-123',
	redirectUris: ['https://example.com/callback'],
	clientName: 'Epicflare Demo',
	tokenEndpointAuthMethod: 'client_secret_basic',
}

const createHelpers = (
	overrides: Partial<OAuthHelpers> = {},
): OAuthHelpers => ({
	parseAuthRequest: async () => baseAuthRequest,
	lookupClient: async () => baseClient,
	completeAuthorization: async () => ({
		redirectTo: 'https://example.com/callback?code=demo',
	}),
	createClient: async () => {
		throw new Error('Not implemented')
	},
	listClients: async () => ({ items: [] }),
	updateClient: async () => null,
	deleteClient: async () => undefined,
	listUserGrants: async () => ({ items: [] }),
	revokeGrant: async () => undefined,
	unwrapToken: async () => null,
	...overrides,
})

const passwordHashPrefix = 'pbkdf2_sha256'
const passwordSaltBytes = 16
const passwordHashBytes = 32
const passwordHashIterations = 120_000

const toHex = (bytes: Uint8Array) =>
	Array.from(bytes)
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('')

const createPasswordHash = async (password: string) => {
	const salt = crypto.getRandomValues(new Uint8Array(passwordSaltBytes))
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
			iterations: passwordHashIterations,
			hash: 'SHA-256',
		},
		key,
		passwordHashBytes * 8,
	)
	const hash = new Uint8Array(derivedBits)
	return `${passwordHashPrefix}$${passwordHashIterations}$${toHex(salt)}$${toHex(
		hash,
	)}`
}

const createDatabase = async (password: string) => {
	const passwordHash = await createPasswordHash(password)
	return {
		prepare: () => ({
			bind: () => ({
				first: async () => ({ password_hash: passwordHash }),
			}),
		}),
	} as unknown as D1Database
}

const createEnv = (helpers: OAuthHelpers, appDb?: D1Database) =>
	({ OAUTH_PROVIDER: helpers, APP_DB: appDb }) as unknown as Env

const createFormRequest = (
	data: Record<string, string>,
	headers: Record<string, string> = {},
) =>
	new Request('https://example.com/oauth/authorize', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			...headers,
		},
		body: new URLSearchParams(data),
	})

test('authorize page returns SPA shell', async () => {
	const response = await handleAuthorizeRequest(
		new Request('https://example.com/oauth/authorize'),
		createEnv(createHelpers()),
	)

	expect(response.status).toBe(200)
	const body = await response.text()
	expect(body).toContain('client-entry.js')
	expect(body).toContain('app-shell')
})

test('authorize info returns client and scopes', async () => {
	const response = await handleAuthorizeInfo(
		new Request(
			'https://example.com/oauth/authorize-info?response_type=code&client_id=client-123&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&scope=profile&state=demo',
		),
		createEnv(createHelpers()),
	)

	expect(response.status).toBe(200)
	const payload = await response.json()
	expect(payload).toEqual({
		ok: true,
		client: { id: baseClient.clientId, name: baseClient.clientName },
		scopes: baseAuthRequest.scope,
	})
})

test('authorize denies access and redirects with error', async () => {
	const response = await handleAuthorizeRequest(
		createFormRequest({ decision: 'deny' }),
		createEnv(createHelpers()),
	)

	expect(response.status).toBe(302)
	const location = response.headers.get('Location')
	expect(location).toBeTruthy()
	const redirectUrl = new URL(location as string)
	const expectedRedirect = new URL(baseAuthRequest.redirectUri)
	expect(redirectUrl.origin).toBe(expectedRedirect.origin)
	expect(redirectUrl.pathname).toBe(expectedRedirect.pathname)
	expect(redirectUrl.searchParams.get('error')).toBe('access_denied')
	expect(redirectUrl.searchParams.get('state')).toBe('demo')
})

test('authorize requires email and password for approval', async () => {
	const response = await handleAuthorizeRequest(
		createFormRequest(
			{ decision: 'approve', email: 'user@example.com' },
			{ Accept: 'application/json' },
		),
		createEnv(createHelpers()),
	)

	expect(response.status).toBe(400)
	const payload = await response.json()
	expect(payload).toEqual({
		ok: false,
		error: 'Email and password are required.',
		code: 'invalid_request',
	})
})

test('authorize uses default scopes when none requested', async () => {
	let capturedOptions: CompleteAuthorizationOptions | null = null
	const helpers = createHelpers({
		parseAuthRequest: async () => ({
			...baseAuthRequest,
			scope: [],
		}),
		completeAuthorization: async (options) => {
			capturedOptions = options
			return { redirectTo: 'https://example.com/callback?code=ok' }
		},
	})
	const response = await handleAuthorizeRequest(
		createFormRequest({
			decision: 'approve',
			email: 'user@example.com',
			password: 'password123',
		}),
		createEnv(helpers, await createDatabase('password123')),
	)

	expect(response.status).toBe(302)
	expect(response.headers.get('Location')).toBe(
		'https://example.com/callback?code=ok',
	)
	expect(capturedOptions?.scope).toEqual(oauthScopes)
})

test('oauth callback page returns SPA shell', async () => {
	const response = handleOAuthCallback(
		new Request('https://example.com/oauth/callback?code=abc123&state=demo'),
	)

	expect(response.status).toBe(200)
	const body = await response.text()
	expect(body).toContain('client-entry.js')
	expect(body).toContain('app-shell')
})
