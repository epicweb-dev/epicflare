import { setAuthSessionSecret } from './auth-session.ts'
import { setAppDb } from './app-env.ts'
import { getEnv } from './env.ts'
import router from './router.ts'

export async function handleRequest(request: Request, env: Env) {
	try {
		const appEnv = getEnv(env)
		setAuthSessionSecret(appEnv.COOKIE_SECRET)
		setAppDb(env.APP_DB)
		return await router.fetch(request)
	} catch (error) {
		console.error('Remix server handler failed:', error)
		return new Response('Internal Server Error', { status: 500 })
	}
}
