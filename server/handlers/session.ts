// @ts-expect-error debug-only host fs instrumentation
import { appendFileSync } from 'node:fs'
import { type BuildAction } from 'remix/fetch-router'
import { readAuthSession } from '#server/auth-session.ts'
import type routes from '#server/routes.ts'

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
		// #region agent log
		try {
			appendFileSync(
				'/opt/cursor/logs/debug.log',
				`${JSON.stringify({
					hypothesisId: 'H3',
					location: 'server/handlers/session.ts:23',
					message: 'session handler evaluated auth session',
					data: {
						requestPath: new URL(request.url).pathname,
						hasCookieHeader: Boolean(request.headers.get('cookie')),
						hasSession: Boolean(session),
						emailLength: session?.email.length ?? 0,
					},
					timestamp: Date.now(),
				})}\n`,
			)
		} catch {}
		// #endregion
		if (!session) {
			return jsonResponse({ ok: false })
		}

		return jsonResponse({ ok: true, session: { email: session.email } })
	},
} satisfies BuildAction<
	typeof routes.session.method,
	typeof routes.session.pattern
>
