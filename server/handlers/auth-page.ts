import { readAuthSession } from '../auth-session.ts'
import { Layout } from '../layout.ts'
import { render } from '../render.ts'

export function createAuthPageHandler() {
	return {
		middleware: [],
		async action({ request }: { request: Request }) {
			const session = await readAuthSession(request)
			if (session) {
				return Response.redirect(new URL('/account', request.url), 302)
			}

			return render(Layout({}))
		},
	}
}
