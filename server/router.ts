import { createRouter } from 'remix/fetch-router'
import { type AppEnv } from '#types/env-schema.ts'
import { account } from './handlers/account.ts'
import { createAuthHandler } from './handlers/auth.ts'
import { chat } from './handlers/chat.ts'
import {
	createChatThreadsHandler,
	createDeleteChatThreadHandler,
	createUpdateChatThreadHandler,
} from './handlers/chat-threads.ts'
import { createHealthHandler } from './handlers/health.ts'
import { home } from './handlers/home.ts'
import { login } from './handlers/login.ts'
import { logout } from './handlers/logout.ts'
import {
	createPasswordResetConfirmHandler,
	createPasswordResetRequestHandler,
} from './handlers/password-reset.ts'
import { session } from './handlers/session.ts'
import { signup } from './handlers/signup.ts'
import { Layout } from './layout.ts'
import { render } from './render.ts'
import { routes } from './routes.ts'

export function createAppRouter(appEnv: AppEnv) {
	const router = createRouter({
		middleware: [],
		async defaultHandler() {
			return render(Layout({}))
		},
	})
	const chatThreadsHandler = createChatThreadsHandler(appEnv)
	router.map(routes, {
		actions: {
			home,
			chat,
			chatThread: chat,
			chatThreads: chatThreadsHandler,
			chatThreadsCreate: chatThreadsHandler,
			chatThreadsUpdate: createUpdateChatThreadHandler(appEnv),
			chatThreadsDelete: createDeleteChatThreadHandler(appEnv),
			health: createHealthHandler(appEnv),
			login,
			signup,
			account,
			auth: createAuthHandler(appEnv),
			session,
			logout,
			passwordResetRequest: createPasswordResetRequestHandler(appEnv),
			passwordResetConfirm: createPasswordResetConfirmHandler(appEnv),
		},
	})

	return router
}
