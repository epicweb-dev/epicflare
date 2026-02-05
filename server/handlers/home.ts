import { type BuildAction } from 'remix/fetch-router'
import { Layout } from '../layout.ts'
import { render } from '../render.ts'
import type routes from '../routes.ts'

export default {
	middleware: [],
	async action() {
		return render(Layout({}))
	},
} satisfies BuildAction<typeof routes.home.method, typeof routes.home.pattern>
