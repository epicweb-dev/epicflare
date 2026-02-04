import { MCP } from './mcp/index.ts'
import { withCors } from './utils.ts'

export { MCP }

export default {
	fetch: withCors({
		getCorsHeaders: () => ({
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'content-type',
		}),
		handler: async (request: Request, env: Env, ctx: ExecutionContext<any>) => {
			const url = new URL(request.url)

			if (url.pathname === '/mcp') {
				ctx.props.baseUrl = url.origin

				return MCP.serve('/mcp', {
					binding: 'MCP_OBJECT',
				}).fetch(request, env, ctx)
			}

			// Try to serve static assets
			if (env.ASSETS) {
				const response = await env.ASSETS.fetch(request)
				if (response.ok) {
					return response
				}
			}

			return new Response(null, { status: 404 })
		},
	}),
}
