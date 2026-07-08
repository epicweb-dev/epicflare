import { createRouter } from 'remix/router'
import { type AppEnv } from '#types/env-schema.ts'
import { createAccountHandler } from './handlers/account.ts'
import { createAuthHandler } from './handlers/auth.ts'
import { createChatHandler } from './handlers/chat.ts'
import {
	createChatThreadsHandler,
	createDeleteChatThreadHandler,
	createUpdateChatThreadHandler,
} from './handlers/chat-threads.ts'
import { createHealthHandler } from './handlers/health.ts'
import { createHomeHandler } from './handlers/home.ts'
import { createLoginHandler } from './handlers/login.ts'
import { logout } from './handlers/logout.ts'
import {
	createPasswordResetConfirmHandler,
	createResetPasswordPageHandler,
	createPasswordResetRequestHandler,
} from './handlers/password-reset.ts'
import { session } from './handlers/session.ts'
import { createSignupHandler } from './handlers/signup.ts'
import { renderAppPage } from './ssr-render.tsx'
import { routes } from './routes.ts'

export function createAppRouter(appEnv: AppEnv) {
	const router = createRouter({
		middleware: [],
		async defaultHandler({ request }) {
			return renderAppPage({
				request,
				appEnv,
				title: 'Not Found',
				notFound: true,
				status: 404,
			})
		},
	})
	const chatThreadsHandler = createChatThreadsHandler(appEnv)

	router.map(routes.home, createHomeHandler(appEnv))
	router.map(routes.chat, createChatHandler(appEnv))
	router.map(routes.chatThread, createChatHandler(appEnv))
	router.map(routes.chatThreads, chatThreadsHandler)
	router.map(routes.chatThreadsCreate, chatThreadsHandler)
	router.map(routes.chatThreadsUpdate, createUpdateChatThreadHandler(appEnv))
	router.map(routes.chatThreadsDelete, createDeleteChatThreadHandler(appEnv))
	router.map(routes.health, createHealthHandler(appEnv))
	router.map(routes.login, createLoginHandler(appEnv))
	router.map(routes.signup, createSignupHandler(appEnv))
	router.map(routes.account, createAccountHandler(appEnv))
	router.map(routes.auth, createAuthHandler(appEnv))
	router.map(routes.session, session)
	router.map(routes.logout, logout)
	router.map(routes.resetPassword, createResetPasswordPageHandler(appEnv))
	router.map(
		routes.passwordResetRequest,
		createPasswordResetRequestHandler(appEnv),
	)
	router.map(
		routes.passwordResetConfirm,
		createPasswordResetConfirmHandler(appEnv),
	)

	return router
}
