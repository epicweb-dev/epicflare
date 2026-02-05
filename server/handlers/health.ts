import  { type BuildAction } from 'remix/fetch-router'
import type routes from '../routes.ts'

export default {
	middleware: [],
	async action() {
		return new Response(JSON.stringify({ ok: true }), {
			headers: { 'Content-Type': 'application/json' },
		})
	},
} satisfies BuildAction<
	typeof routes.health.method,
	typeof routes.health.pattern
>
