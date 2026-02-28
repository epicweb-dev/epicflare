import { type BuildAction } from 'remix/fetch-router'
import { destroyAuthCookie } from '#server/auth-session.ts'
import { type routes } from '#server/routes.ts'

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

export const logout = {
	middleware: [],
	async action({ request }) {
		const cookie = await destroyAuthCookie(isSecureRequest(request))
		const location = new URL('/login', request.url)

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
