import { type Action } from 'remix/router'
import { type AppEnv } from '#types/env-schema.ts'
import {
	readAuthSessionResult,
	setAuthSessionSecret,
} from '#server/auth-session.ts'
import { redirectToLogin } from '#server/auth-redirect.ts'
import { type routes } from '#server/routes.ts'
import { renderAppPage } from '#server/ssr-render.tsx'

export function createAccountHandler(appEnv: AppEnv) {
	return {
		middleware: [],
		async handler({ request }) {
			setAuthSessionSecret(appEnv.COOKIE_SECRET)
			const { session } = await readAuthSessionResult(request)

			if (!session) {
				return redirectToLogin(request)
			}

			return renderAppPage({
				request,
				appEnv,
				title: 'Account',
				loaderData: {
					account: {
						ok: true,
						email: session.email,
					},
				},
			})
		},
	} satisfies Action<typeof routes.account>
}
