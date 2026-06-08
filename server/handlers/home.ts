import { type Action } from 'remix/router'
import { Layout } from '#server/layout.ts'
import { render } from '#server/render.ts'
import { type routes } from '#server/routes.ts'

export const home = {
	middleware: [],
	async handler() {
		return render(Layout({}))
	},
} satisfies Action<typeof routes.home>
