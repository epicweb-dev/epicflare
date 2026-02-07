import { type BuildAction } from 'remix/fetch-router'
import { readAuthSession } from '../auth-session.ts'
import type routes from '../routes.ts'

function jsonResponse(data: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(data), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
			...init?.headers,
		},
	})
}

export default {
	middleware: [],
	async action({ request }) {
		const session = await readAuthSession(request)
		if (!session) {
			return jsonResponse({ ok: false })
		}

		return jsonResponse({ ok: true, session: { email: session.email } })
	},
} satisfies BuildAction<
	typeof routes.session.method,
	typeof routes.session.pattern
>
