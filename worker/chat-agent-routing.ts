import { routeAgentRequest } from 'agents'
import { readAuthenticatedAppUser } from '#server/authenticated-user.ts'
import { createChatThreadsStore } from '#server/chat-threads.ts'
import { chatAgentBasePath } from '#shared/chat-routes.ts'

function createJsonResponse(data: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(data), {
		...init,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'no-store',
			...init?.headers,
		},
	})
}

function getThreadIdFromPath(pathname: string) {
	if (!pathname.startsWith(`${chatAgentBasePath}/`)) return null
	const pathAfterBase = pathname.slice(chatAgentBasePath.length + 1)
	const [threadId] = pathAfterBase.split('/')
	return threadId?.trim() || null
}

export async function handleChatAgentRequest(request: Request, env: Env) {
	const url = new URL(request.url)
	const threadId = getThreadIdFromPath(url.pathname)
	if (!threadId) {
		return createJsonResponse(
			{ ok: false, error: 'Thread ID is required.' },
			{ status: 400 },
		)
	}

	const user = await readAuthenticatedAppUser(request, env)
	if (!user) {
		return createJsonResponse(
			{ ok: false, error: 'Unauthorized' },
			{ status: 401 },
		)
	}

	const threadStore = createChatThreadsStore(env.APP_DB)
	const thread = await threadStore.getForUser(user.userId, threadId)
	if (!thread) {
		return createJsonResponse(
			{ ok: false, error: 'Thread not found.' },
			{ status: 404 },
		)
	}

	return (
		(await routeAgentRequest(request, env)) ??
		createJsonResponse({ ok: false, error: 'Not found.' }, { status: 404 })
	)
}
