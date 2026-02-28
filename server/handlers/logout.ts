import { type BuildAction } from 'remix/fetch-router'
import { destroyAuthCookie } from '#server/auth-session.ts'
import type routes from '#server/routes.ts'

function normalizeProto(value: string) {
	return value.trim().replace(/^"|"$/g, '').toLowerCase()
}

function getForwardedProto(request: Request) {
	const forwarded = request.headers.get('forwarded')
	if (forwarded) {
		for (const entry of forwarded.split(',')) {
			for (const pair of entry.split(';')) {
				const [key, rawValue] = pair.split('=')
				if (!key || !rawValue) continue
				if (key.trim().toLowerCase() === 'proto') {
					return normalizeProto(rawValue)
				}
			}
		}
	}

	const xForwardedProto = request.headers.get('x-forwarded-proto')
	if (xForwardedProto) {
		return normalizeProto(xForwardedProto.split(',')[0] ?? '')
	}

	return null
}

function isSecureRequest(request: Request) {
	const forwardedProto = getForwardedProto(request)
	if (forwardedProto) {
		return forwardedProto === 'https'
	}
	return new URL(request.url).protocol === 'https:'
}

export default {
	middleware: [],
	async action({ request }) {
		const cookie = await destroyAuthCookie(isSecureRequest(request))
		const location = new URL('/login', request.url)
		// #region agent log
		console.log(
			JSON.stringify({
				hypothesisId: 'H4',
				location: 'server/handlers/logout.ts:46',
				message: 'logout handler returning redirect',
				data: {
					requestPath: new URL(request.url).pathname,
					hasCookieHeader: Boolean(request.headers.get('cookie')),
					isSecure: isSecureRequest(request),
					location: location.toString(),
					debugRouteFrom: request.headers.get('x-agent-debug-route-from'),
					debugRouteAction: request.headers.get('x-agent-debug-route-action'),
					setCookieStartsWith: cookie.slice(
						0,
						cookie.indexOf(';') > -1 ? cookie.indexOf(';') : cookie.length,
					),
				},
				timestamp: Date.now(),
			}),
		)
		// #endregion

		return new Response(null, {
			status: 302,
			headers: {
				Location: location.toString(),
				'Set-Cookie': cookie,
			},
		})
	},
} satisfies BuildAction<
	typeof routes.logout.method,
	typeof routes.logout.pattern
>
