import { setAuthSessionSecret } from './auth-session.ts'
import { getEnv } from './env.ts'
import { createAppRouter } from './router.ts'

function formatErrorChain(error: unknown) {
	if (!(error instanceof Error)) {
		return String(error)
	}
	const parts: Array<string> = [error.stack ?? error.message]
	let current: unknown = (error as { cause?: unknown }).cause
	let depth = 0
	while (current && depth < 4) {
		if (current instanceof Error) {
			parts.push(`\nCaused by:\n${current.stack ?? current.message}`)
			current = (current as { cause?: unknown }).cause
		} else {
			parts.push(`\nCaused by:\n${String(current)}`)
			break
		}
		depth += 1
	}
	return parts.join('\n')
}

export async function handleRequest(request: Request, env: Env) {
	try {
		const appEnv = getEnv(env)
		setAuthSessionSecret(appEnv.COOKIE_SECRET)
		const router = createAppRouter(appEnv)
		return await router.fetch(request)
	} catch (error) {
		console.error('Remix server handler failed:', error)
		const debugErrors =
			(env as unknown as { EXPOSE_INTERNAL_ERRORS?: unknown })
				.EXPOSE_INTERNAL_ERRORS === 'true'
		const details = formatErrorChain(error)
		return new Response(
			debugErrors ? `Internal Server Error\n\n${details}` : 'Internal Server Error',
			{ status: 500 },
		)
	}
}
