import type {
	OAuthHelpers,
	TokenSummary,
} from '@cloudflare/workers-oauth-provider'
import { oauthScopes } from './oauth-handlers.ts'

export const mcpResourcePath = '/mcp'
export const protectedResourceMetadataPath =
	'/.well-known/oauth-protected-resource'

type OAuthEnv = Env & {
	OAUTH_PROVIDER?: OAuthHelpers
}

type OAuthContextProps = {
	baseUrl: string
	user?: TokenSummary['grant']['props']
}

type OAuthExecutionContext = ExecutionContext & {
	props?: OAuthContextProps
}

export const buildProtectedResourceMetadata = (origin: string) => ({
	resource: `${origin}${mcpResourcePath}`,
	authorization_servers: [origin],
	scopes_supported: oauthScopes,
})

export const isProtectedResourceMetadataRequest = (pathname: string) =>
	pathname === protectedResourceMetadataPath ||
	pathname === `${protectedResourceMetadataPath}${mcpResourcePath}`

export const handleProtectedResourceMetadata = (request: Request) => {
	const url = new URL(request.url)
	return new Response(
		JSON.stringify(buildProtectedResourceMetadata(url.origin)),
		{
			headers: { 'Content-Type': 'application/json' },
		},
	)
}

const buildWwwAuthenticateHeader = (origin: string) => {
	const resourceMetadata = `${origin}${protectedResourceMetadataPath}`
	const scope =
		oauthScopes.length > 0 ? ` scope="${oauthScopes.join(' ')}"` : ''
	return `Bearer resource_metadata="${resourceMetadata}"${scope}`
}

const createUnauthorizedResponse = (requestUrl: URL) =>
	new Response(null, {
		status: 401,
		headers: {
			'WWW-Authenticate': buildWwwAuthenticateHeader(requestUrl.origin),
		},
	})

const audienceMatches = (
	audience: string | string[] | undefined,
	requestUrl: URL,
) => {
	if (!audience) return true
	const allowed = Array.isArray(audience) ? audience : [audience]
	const origin = requestUrl.origin
	const resourcePath = `${origin}${mcpResourcePath}`
	return allowed.some((value) => value === origin || value === resourcePath)
}

export async function handleMcpRequest({
	request,
	env,
	ctx,
	fetchMcp,
}: {
	request: Request
	env: Env
	ctx: ExecutionContext
	fetchMcp: CustomExportedHandler<OAuthContextProps>['fetch']
}) {
	const url = new URL(request.url)
	const authHeader = request.headers.get('Authorization')
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return createUnauthorizedResponse(url)
	}

	const token = authHeader.slice('Bearer '.length).trim()
	if (!token) {
		return createUnauthorizedResponse(url)
	}

	const helpers = (env as OAuthEnv).OAUTH_PROVIDER
	if (!helpers) {
		return createUnauthorizedResponse(url)
	}

	const tokenSummary = await helpers.unwrapToken(token)
	if (!tokenSummary || !audienceMatches(tokenSummary.audience, url)) {
		return createUnauthorizedResponse(url)
	}

	const context = ctx as OAuthExecutionContext
	context.props = {
		...context.props,
		baseUrl: url.origin,
		user: tokenSummary.grant.props,
	}

	return fetchMcp(request, env, context)
}
