import { createCookie } from '@remix-run/cookie'
import { type BuildAction } from 'remix/fetch-router'
import type routes from '../routes.ts'

const sessionMaxAgeSeconds = 60 * 60 * 24 * 7

type AuthMode = 'login' | 'signup'

const isAuthMode = (value: string): value is AuthMode =>
	value === 'login' || value === 'signup'

const sessionCookie = createCookie('epicflare_session', {
	httpOnly: true,
	sameSite: 'Lax',
	path: '/',
	maxAge: sessionMaxAgeSeconds,
})

const jsonResponse = (data: unknown, init?: ResponseInit) =>
	new Response(JSON.stringify(data), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers,
		},
	})

export default {
	middleware: [],
	async action({ request, url }) {
		let body: unknown

		try {
			body = await request.json()
		} catch {
			return jsonResponse({ error: 'Invalid JSON payload.' }, { status: 400 })
		}

		if (!body || typeof body !== 'object') {
			return jsonResponse({ error: 'Invalid request body.' }, { status: 400 })
		}

		const { email, password, mode } = body as Record<string, unknown>
		const normalizedEmail = typeof email === 'string' ? email.trim() : ''
		const normalizedPassword = typeof password === 'string' ? password : ''
		const normalizedMode =
			typeof mode === 'string' && isAuthMode(mode) ? mode : null

		if (!normalizedEmail || !normalizedPassword || !normalizedMode) {
			return jsonResponse(
				{ error: 'Email, password, and mode are required.' },
				{ status: 400 },
			)
		}

		const sessionValue = crypto.randomUUID()
		const cookie = await sessionCookie.serialize(sessionValue, {
			secure: url.protocol === 'https:',
		})

		return jsonResponse(
			{ ok: true, mode: normalizedMode },
			{
				headers: {
					'Set-Cookie': cookie,
				},
			},
		)
	},
} satisfies BuildAction<typeof routes.auth.method, typeof routes.auth.pattern>
