import {
	type AuthRequest,
	type ClientInfo,
	type OAuthHelpers,
} from '@cloudflare/workers-oauth-provider'
import { html, type SafeHtml } from 'remix/html-template'
import { Layout } from '../server/layout.ts'
import { render } from '../server/render.ts'

export const oauthPaths = {
	authorize: '/oauth/authorize',
	token: '/oauth/token',
	register: '/oauth/register',
	callback: '/oauth/callback',
	apiPrefix: '/api/',
}

export const oauthScopes = ['profile', 'email']

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

const escapeHtml = (value: string) =>
	value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')

const createUserId = async (email: string) => {
	const normalized = email.trim().toLowerCase()
	const data = new TextEncoder().encode(normalized)
	const hash = await crypto.subtle.digest('SHA-256', data)
	return Array.from(new Uint8Array(hash))
		.map((value) => value.toString(16).padStart(2, '0'))
		.join('')
}

const renderPage = (title: string, body: SafeHtml, status = 200) =>
	render(
		Layout({
			title,
			entryScripts: false,
			children: body,
		}),
		{ status },
	)

const renderAuthorizePage = ({
	request,
	client,
	errorMessage,
	emailValue,
}: {
	request: AuthRequest
	client: ClientInfo
	errorMessage?: string
	emailValue?: string
}) => {
	const clientLabel = client.clientName ?? client.clientId
	const scopeList =
		request.scope.length > 0 ? request.scope.join(', ') : oauthScopes.join(', ')
	const searchParams = new URLSearchParams()
	if (request.responseType)
		searchParams.set('response_type', request.responseType)
	searchParams.set('client_id', request.clientId)
	searchParams.set('redirect_uri', request.redirectUri)
	if (request.scope.length > 0) {
		searchParams.set('scope', request.scope.join(' '))
	}
	if (request.state) searchParams.set('state', request.state)
	if (request.codeChallenge) {
		searchParams.set('code_challenge', request.codeChallenge)
		if (request.codeChallengeMethod) {
			searchParams.set('code_challenge_method', request.codeChallengeMethod)
		}
	}
	if (request.resource) {
		const resources = Array.isArray(request.resource)
			? request.resource
			: [request.resource]
		resources.forEach((resource) => searchParams.append('resource', resource))
	}
	const actionPath = `${oauthPaths.authorize}?${searchParams.toString()}`
	const message = errorMessage
		? html`<p
				style="color: var(--color-primary); font-weight: var(--font-weight-medium);"
				role="alert"
			>
				${errorMessage}
			</p>`
		: html``

	return renderPage(
		'Authorize access',
		html`<main
			style="max-width: 32rem; margin: 0 auto; padding: var(--spacing-page); display: grid; gap: var(--spacing-lg);"
		>
			<header style="display: grid; gap: var(--spacing-xs);">
				<h1
					style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); margin: 0;"
				>
					Authorize access
				</h1>
				<p style="color: var(--color-text-muted); margin: 0;">
					${clientLabel} wants to access your Epicflare account.
				</p>
			</header>
			<section
				style="padding: var(--spacing-lg); border-radius: var(--radius-lg); border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-sm); display: grid; gap: var(--spacing-md);"
			>
				<p style="margin: 0; font-weight: var(--font-weight-medium);">
					Requested scopes
				</p>
				<p style="margin: 0; color: var(--color-text-muted);">
					${scopeList || 'No scopes requested.'}
				</p>
			</section>
			${message}
			<form
				method="post"
				action="${actionPath}"
				style="display: grid; gap: var(--spacing-md); padding: var(--spacing-lg); border-radius: var(--radius-lg); border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-sm);"
			>
				<label style="display: grid; gap: var(--spacing-xs);">
					<span style="font-weight: var(--font-weight-medium);">Email</span>
					<input
						type="email"
						name="email"
						required
						autocomplete="email"
						value="${emailValue ?? ''}"
						placeholder="you@example.com"
						style="padding: var(--spacing-sm); border-radius: var(--radius-md); border: 1px solid var(--color-border); font-size: var(--font-size-base); font-family: var(--font-family);"
					/>
				</label>
				<label style="display: grid; gap: var(--spacing-xs);">
					<span style="font-weight: var(--font-weight-medium);">Password</span>
					<input
						type="password"
						name="password"
						required
						autocomplete="current-password"
						placeholder="Enter your password"
						style="padding: var(--spacing-sm); border-radius: var(--radius-md); border: 1px solid var(--color-border); font-size: var(--font-size-base); font-family: var(--font-family);"
					/>
				</label>
				<div style="display: flex; gap: var(--spacing-sm); flex-wrap: wrap;">
					<button
						type="submit"
						name="decision"
						value="approve"
						style="padding: var(--spacing-sm) var(--spacing-lg); border-radius: var(--radius-full); border: none; background: var(--color-primary); color: var(--color-on-primary); font-weight: var(--font-weight-semibold); cursor: pointer;"
					>
						Authorize
					</button>
					<button
						type="submit"
						name="decision"
						value="deny"
						style="padding: var(--spacing-sm) var(--spacing-lg); border-radius: var(--radius-full); border: 1px solid var(--color-border); background: transparent; color: var(--color-text); font-weight: var(--font-weight-medium); cursor: pointer;"
					>
						Deny
					</button>
				</div>
			</form>
		</main>`,
		errorMessage ? 400 : 200,
	)
}

const renderErrorPage = (message: string, status = 400) =>
	renderPage(
		'OAuth error',
		html`<main
			style="max-width: 32rem; margin: 0 auto; padding: var(--spacing-page); display: grid; gap: var(--spacing-md);"
		>
			<h1
				style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); margin: 0;"
			>
				OAuth error
			</h1>
			<p style="margin: 0; color: var(--color-text-muted);">${message}</p>
			<a href="/" style="color: var(--color-primary); text-decoration: none;"
				>Back home</a
			>
		</main>`,
		status,
	)

const renderCallbackPage = ({
	code,
	error,
	description,
	state,
}: {
	code: string | null
	error: string | null
	description: string | null
	state: string | null
}) => {
	const statusLine = error
		? `Authorization failed: ${error}`
		: 'Authorization completed.'
	const details = error
		? (description ?? 'No description provided.')
		: (code ?? '')
	const detailsMarkup = details
		? html.raw`<pre style="margin: 0; padding: var(--spacing-md); border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-border); white-space: pre-wrap;">${escapeHtml(details)}</pre>`
		: html``
	return renderPage(
		'OAuth callback',
		html`<main
			style="max-width: 36rem; margin: 0 auto; padding: var(--spacing-page); display: grid; gap: var(--spacing-md);"
		>
			<h1
				style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); margin: 0;"
			>
				OAuth callback
			</h1>
			<p style="margin: 0; color: var(--color-text-muted);">${statusLine}</p>
			${detailsMarkup}
			${state
				? html`<p style="margin: 0; color: var(--color-text-muted);">
						State: ${state}
					</p>`
				: html``}
		</main>`,
		error ? 400 : 200,
	)
}

const getOAuthHelpers = (env: Env) => {
	const helpers = (env as OAuthEnv).OAUTH_PROVIDER
	if (!helpers) {
		throw new Error('OAuth provider helpers are not available.')
	}
	return helpers
}

const resolveAuthRequest = async (helpers: OAuthHelpers, request: Request) => {
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

const resolveScopes = (requestedScopes: string[]) => {
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

const createAccessDeniedRedirect = (request: AuthRequest) => {
	if (!request.redirectUri) {
		return renderErrorPage('Missing redirect URI for access denial.', 400)
	}
	const redirectUrl = new URL(request.redirectUri)
	redirectUrl.searchParams.set('error', 'access_denied')
	if (request.state) redirectUrl.searchParams.set('state', request.state)
	return Response.redirect(redirectUrl.toString(), 302)
}

export async function handleAuthorizeRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	const helpers = getOAuthHelpers(env)

	const resolution = await resolveAuthRequest(helpers, request)
	if ('error' in resolution) {
		return renderErrorPage(resolution.error)
	}

	const { authRequest, client } = resolution

	if (request.method === 'GET') {
		return renderAuthorizePage({
			request: authRequest,
			client,
		})
	}

	if (request.method !== 'POST') {
		return new Response('Method not allowed', { status: 405 })
	}

	const formData = await request.formData()
	const decision = String(formData.get('decision') ?? 'approve')
	if (decision === 'deny') {
		return createAccessDeniedRedirect(authRequest)
	}

	const email = String(formData.get('email') ?? '').trim()
	const password = String(formData.get('password') ?? '')

	if (!email || !password) {
		return renderAuthorizePage({
			request: authRequest,
			client,
			errorMessage: 'Email and password are required.',
			emailValue: email,
		})
	}

	const resolvedScopes = resolveScopes(authRequest.scope)
	if (Array.isArray(resolvedScopes)) {
		const userId = await createUserId(email)
		const displayName = email.split('@')[0] || 'user'
		const { redirectTo } = await helpers.completeAuthorization({
			request: authRequest,
			userId,
			metadata: {
				email,
				clientId: authRequest.clientId,
			},
			scope: resolvedScopes,
			props: {
				userId,
				email,
				displayName,
			},
		})
		return Response.redirect(redirectTo, 302)
	}

	return renderAuthorizePage({
		request: authRequest,
		client,
		errorMessage: resolvedScopes.error,
		emailValue: email,
	})
}

export function handleOAuthCallback(request: Request): Response {
	const url = new URL(request.url)
	return renderCallbackPage({
		code: url.searchParams.get('code'),
		error: url.searchParams.get('error'),
		description: url.searchParams.get('error_description'),
		state: url.searchParams.get('state'),
	})
}

const jsonResponse = (data: unknown, init?: ResponseInit) =>
	new Response(JSON.stringify(data), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers,
		},
	})

export const apiHandler = {
	async fetch(request: Request, _env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url)
		if (url.pathname === '/api/me') {
			const props = (ctx as OAuthContext).props ?? null
			return jsonResponse({ ok: true, user: props })
		}

		return jsonResponse({ error: 'Not found' }, { status: 404 })
	},
} satisfies ExportedHandler
