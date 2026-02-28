// @ts-expect-error debug-only host fs instrumentation
import { appendFileSync } from 'node:fs'
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
		try {
			appendFileSync(
				'/opt/cursor/logs/debug.log',
				`${JSON.stringify({
					hypothesisId: 'H4',
					location: 'server/handlers/logout.ts:47',
					message: 'logout handler returning redirect',
					data: {
						requestPath: new URL(request.url).pathname,
						hasCookieHeader: Boolean(request.headers.get('cookie')),
						isSecure: isSecureRequest(request),
						location: location.toString(),
						setCookieStartsWith: cookie.slice(0, cookie.indexOf(';') > -1 ? cookie.indexOf(';') : cookie.length),
					},
					timestamp: Date.now(),
				})}\n`,
			)
		} catch {}
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
