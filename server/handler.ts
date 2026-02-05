import { setAuthSessionSecret } from './auth-session.ts'
import router from './router.ts'

function resolveCookieSecret(env: Env) {
	const secret = env.COOKIE_SECRET

	if (!secret) {
		throw new Error('Missing COOKIE_SECRET for session signing.')
	}

	return secret
}

export async function handleRequest(request: Request, env: Env) {
	try {
		setAuthSessionSecret(resolveCookieSecret(env))
		return await router.fetch(request)
	} catch (error) {
		console.error('Remix server handler failed:', error)
		return new Response('Internal Server Error', { status: 500 })
	}
}
