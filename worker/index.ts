import { OAuthProvider } from '@cloudflare/workers-oauth-provider'
import { MCP } from '../mcp/index.ts'
import { handleRequest } from '../server/handler.ts'
import { getRequestIp, logAuditEvent } from '../server/audit-log.ts'
import {
	apiHandler,
	handleAuthorizeRequest,
	handleAuthorizeInfo,
	handleOAuthCallback,
	oauthPaths,
	oauthScopes,
} from './oauth-handlers.ts'
import {
	handleMcpRequest,
	handleProtectedResourceMetadata,
	isProtectedResourceMetadataRequest,
	mcpResourcePath,
} from './mcp-auth.ts'
import { wantsJson, withCors } from './utils.ts'

export { MCP }

const rateLimitWindowMs = 60_000
const rateLimitMax = 10
const rateLimitPaths = new Set([
	oauthPaths.authorize,
	oauthPaths.token,
	oauthPaths.register,
	'/auth',
])
const oauthKvDocsUrl =
	'https://developers.cloudflare.com/workers/runtime-apis/kv/#create-a-kv-namespace'

function missingOauthKvResponse(request: Request) {
	const message = `Missing required OAUTH_KV binding. Add a KV namespace bound as "OAUTH_KV" in wrangler.jsonc and redeploy. See ${oauthKvDocsUrl}`
	console.error('OAUTH_KV binding is missing; refusing rate-limited requests.')
	const body = wantsJson(request)
		? JSON.stringify({ ok: false, error: message })
		: message
	return new Response(body, {
		status: 500,
		headers: {
			'Content-Type': wantsJson(request) ? 'application/json' : 'text/plain',
		},
	})
}

function isRateLimitedRequest(request: Request, url: URL) {
	return request.method === 'POST' && rateLimitPaths.has(url.pathname)
}

async function enforceRateLimit(
	request: Request,
	env: Env,
	url: URL,
): Promise<Response | null> {
	if (!isRateLimitedRequest(request, url)) return null
	const oauthKv = env.OAUTH_KV
	if (!oauthKv) return null
	const ip = getRequestIp(request)
	if (!ip) {
		console.warn('Rate limiting skipped: request IP unavailable.', {
			path: url.pathname,
		})
		return null
	}

	try {
		const now = Date.now()
		const key = `rate-limit:${url.pathname}:${ip}`
		const stored = (await oauthKv.get(key, 'json')) as {
			count: number
			reset: number
		} | null
		const windowReset = now + rateLimitWindowMs
		const state =
			!stored || now > stored.reset ? { count: 0, reset: windowReset } : stored
		state.count += 1
		await oauthKv.put(key, JSON.stringify(state), {
			expirationTtl: Math.ceil(rateLimitWindowMs / 1000),
		})

		if (state.count > rateLimitMax) {
			const retryAfterSeconds = Math.max(
				1,
				Math.ceil((state.reset - now) / 1000),
			)
			void logAuditEvent({
				category: 'auth',
				action: 'rate_limit',
				result: 'rate_limited',
				ip,
				path: url.pathname,
				reason: 'too_many_requests',
			})
			const body = wantsJson(request)
				? JSON.stringify({
						ok: false,
						error: 'Too many requests. Please try again later.',
					})
				: 'Too many requests. Please try again later.'
			return new Response(body, {
				status: 429,
				headers: {
					'Content-Type': wantsJson(request)
						? 'application/json'
						: 'text/plain',
					'Retry-After': String(retryAfterSeconds),
				},
			})
		}
	} catch (error) {
		console.warn('Rate limiting failed open due to KV error.', error)
	}

	return null
}

const appHandler = withCors({
	getCorsHeaders(request) {
		const origin = request.headers.get('Origin')
		if (!origin) return null
		const requestOrigin = new URL(request.url).origin
		if (origin === requestOrigin) return null
		return {
			'Access-Control-Allow-Origin': origin,
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'content-type, authorization',
			Vary: 'Origin',
		}
	},
	async handler(request, env, ctx) {
		const url = new URL(request.url)

		if (url.pathname === oauthPaths.authorize) {
			return handleAuthorizeRequest(request, env)
		}

		if (url.pathname === oauthPaths.authorizeInfo) {
			return handleAuthorizeInfo(request, env)
		}

		if (url.pathname === oauthPaths.callback) {
			return handleOAuthCallback(request)
		}

		if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
			return new Response(null, { status: 204 })
		}

		if (isProtectedResourceMetadataRequest(url.pathname)) {
			return handleProtectedResourceMetadata(request)
		}

		if (url.pathname === mcpResourcePath) {
			return handleMcpRequest({
				request,
				env,
				ctx,
				fetchMcp: MCP.serve(mcpResourcePath, {
					binding: 'MCP_OBJECT',
				}).fetch,
			})
		}

		// Try to serve static assets for safe methods only
		if (env.ASSETS && (request.method === 'GET' || request.method === 'HEAD')) {
			const response = await env.ASSETS.fetch(request)
			if (response.ok) {
				return response
			}
		}

		return handleRequest(request, env)
	},
})

const oauthProvider = new OAuthProvider({
	apiRoute: oauthPaths.apiPrefix,
	apiHandler,
	defaultHandler: {
		fetch(request, env, ctx) {
			// @ts-expect-error https://github.com/cloudflare/workers-oauth-provider/issues/71
			return appHandler(request, env, ctx)
		},
	},
	authorizeEndpoint: oauthPaths.authorize,
	tokenEndpoint: oauthPaths.token,
	clientRegistrationEndpoint: oauthPaths.register,
	scopesSupported: oauthScopes,
})

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url)
		if (!env.OAUTH_KV && isRateLimitedRequest(request, url)) {
			return missingOauthKvResponse(request)
		}
		const rateLimitResponse = await enforceRateLimit(request, env, url)
		if (rateLimitResponse) {
			return rateLimitResponse
		}
		return oauthProvider.fetch(request, env, ctx)
	},
} satisfies ExportedHandler<Env>
