import { type Action } from 'remix/router'
import { type AppEnv } from '#types/env-schema.ts'
import { type routes } from '#server/routes.ts'
import { renderAppPage } from '#server/ssr-render.tsx'

export function createHomeHandler(appEnv: AppEnv) {
	return {
		middleware: [],
		async handler({ request }) {
			return renderAppPage({ request, appEnv })
		},
	} satisfies Action<typeof routes.home>
}
