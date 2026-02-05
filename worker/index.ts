import { MCP } from '../mcp/index.ts'
import { handleRequest } from '../server/handler'
import { withCors } from './utils.ts'

export { MCP }

export default {
	fetch: withCors({
		getCorsHeaders: () => ({
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'content-type',
		}),
		handler: async (request: Request, env, ctx) => {
			const url = new URL(request.url)

			if (
				url.pathname === '/.well-known/appspecific/com.chrome.devtools.json'
			) {
				return new Response(null, { status: 204 })
			}

			if (url.pathname === '/mcp') {
				ctx.props.baseUrl = url.origin

				return MCP.serve('/mcp', {
					binding: 'MCP_OBJECT',
				}).fetch(request, env, ctx)
			}

			// Try to serve static assets for safe methods only
			if (
				env.ASSETS &&
				(request.method === 'GET' || request.method === 'HEAD')
			) {
				const response = await env.ASSETS.fetch(request)
				if (response.ok) {
					return response
				}
			}

			return handleRequest(request)
		},
	}),
}
