import { OAuthProvider } from '@cloudflare/workers-oauth-provider'
import { MCP } from '../mcp/index.ts'
import { handleRequest } from '../server/handler'
import {
	apiHandler,
	handleAuthorizeRequest,
	handleOAuthCallback,
	oauthPaths,
	oauthScopes,
} from './oauth-handlers.ts'
import { withCors } from './utils.ts'

export { MCP }

const appHandler = withCors({
	getCorsHeaders: () => ({
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'content-type, authorization',
	}),
	handler: async (request: Request, env, ctx) => {
		const url = new URL(request.url)

		if (url.pathname === oauthPaths.authorize) {
			return handleAuthorizeRequest(request, env)
		}

		if (url.pathname === oauthPaths.callback) {
			return handleOAuthCallback(request)
		}

		if (url.pathname === '/.well-known/appspecific/com.chrome.devtools.json') {
			return new Response(null, { status: 204 })
		}

		if (url.pathname === '/mcp') {
			ctx.props.baseUrl = url.origin

			return MCP.serve('/mcp', {
				binding: 'MCP_OBJECT',
			}).fetch(request, env, ctx)
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
	defaultHandler: { fetch: appHandler },
	authorizeEndpoint: oauthPaths.authorize,
	tokenEndpoint: oauthPaths.token,
	clientRegistrationEndpoint: oauthPaths.register,
	scopesSupported: oauthScopes,
})

export default {
	fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
		oauthProvider.fetch(request, env, ctx),
}
