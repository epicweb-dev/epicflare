import { createCookie } from '@remix-run/cookie'

const sessionMaxAgeSeconds = 60 * 60 * 24 * 7

export type AuthSession = {
	id: string
	email: string
}

let sessionCookie: ReturnType<typeof createCookie> | null = null
let sessionSecret: string | null = null

export const setAuthSessionSecret = (secret: string) => {
	if (!secret) {
		throw new Error('Missing COOKIE_SECRET for session signing.')
	}

	if (sessionCookie && sessionSecret === secret) {
		return
	}

	sessionSecret = secret
	sessionCookie = createCookie('epicflare_session', {
		httpOnly: true,
		sameSite: 'Lax',
		path: '/',
		maxAge: sessionMaxAgeSeconds,
		secrets: [secret],
	})
}

const getSessionCookie = () => {
	if (!sessionCookie) {
		throw new Error('Session cookie not configured. Call setAuthSessionSecret.')
	}

	return sessionCookie
}

const isAuthSession = (value: unknown): value is AuthSession => {
	if (!value || typeof value !== 'object') return false
	const record = value as Record<string, unknown>
	return (
		typeof record.id === 'string' &&
		record.id.length > 0 &&
		typeof record.email === 'string' &&
		record.email.length > 0
	)
}

export async function createAuthCookie(session: AuthSession, secure: boolean) {
	return getSessionCookie().serialize(JSON.stringify(session), { secure })
}

export async function readAuthSession(request: Request) {
	const cookieHeader = request.headers.get('Cookie')
	if (!cookieHeader) return null

	const stored = await getSessionCookie().parse(cookieHeader)
	if (!stored || typeof stored !== 'string') return null

	try {
		const parsed = JSON.parse(stored)
		if (isAuthSession(parsed)) {
			return parsed
		}
	} catch {
		return null
	}

	return null
}
