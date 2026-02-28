import { type BuildAction } from 'remix/fetch-router'
import { type routes } from '#server/routes.ts'

export const health = {
	middleware: [],
	async action() {
		return Response.json({ ok: true })
	},
} satisfies BuildAction<
	typeof routes.health.method,
	typeof routes.health.pattern
>
