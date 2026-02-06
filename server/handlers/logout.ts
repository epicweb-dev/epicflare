import { type BuildAction } from 'remix/fetch-router'
import { destroyAuthCookie } from '../auth-session.ts'
import type routes from '../routes.ts'

export default {
	middleware: [],
	async action({ request }) {
		const requestUrl = new URL(request.url)
		const cookie = await destroyAuthCookie(requestUrl.protocol === 'https:')
		const location = new URL('/login', requestUrl)

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
