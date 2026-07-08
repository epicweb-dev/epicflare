import { type Action } from 'remix/router'
import { type ChatLoaderData } from '#shared/loader-data.ts'
import { type AppEnv } from '#types/env-schema.ts'
import { redirectToLogin } from '#server/auth-redirect.ts'
import { readAuthenticatedAppUser } from '#server/authenticated-user.ts'
import { createChatThreadsStore } from '#server/chat-threads.ts'
import { type routes } from '#server/routes.ts'
import { renderAppPage } from '#server/ssr-render.tsx'

const initialThreadLimit = 40

function getSelectedThreadId(request: Request) {
	const url = new URL(request.url)
	const prefix = '/chat/'
	if (!url.pathname.startsWith(prefix)) return null
	const threadId = url.pathname.slice(prefix.length).trim()
	return threadId || null
}

export function createChatHandler(appEnv: AppEnv) {
	const store = createChatThreadsStore(appEnv.APP_DB)

	return {
		middleware: [],
		async handler({ request }) {
			const user = await readAuthenticatedAppUser(request, appEnv as Env)

			if (!user) {
				return redirectToLogin(request)
			}

			const page = await store.listForUser(user.userId, {
				limit: initialThreadLimit,
			})
			const selectedThreadId = getSelectedThreadId(request)
			const selectedThread = selectedThreadId
				? (await store.getForUser(user.userId, selectedThreadId)) ?? null
				: null
			const threads =
				selectedThread &&
				!page.threads.some((thread) => thread.id === selectedThread.id)
					? [selectedThread, ...page.threads]
					: page.threads
			const loaderData: ChatLoaderData = {
				ok: true,
				threads,
				hasMore: page.hasMore,
				nextCursor: page.nextCursor,
				totalCount: page.totalCount,
				selectedThread,
				search: '',
			}

			return renderAppPage({
				request,
				appEnv,
				title: 'Chat',
				loaderData: { chat: loaderData },
			})
		},
	} satisfies Action<typeof routes.chat>
}
