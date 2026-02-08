import { readAuthSession } from '../auth-session.ts'
import { Layout } from '../layout.ts'
import { render } from '../render.ts'

function normalizeRedirectTo(value: string | null) {
	if (!value) return null
	if (!value.startsWith('/')) return null
	if (value.startsWith('//')) return null
	return value
}

export function createAuthPageHandler() {
	return {
		middleware: [],
		async action({ request }: { request: Request }) {
			const session = await readAuthSession(request)
			if (session) {
				const url = new URL(request.url)
				const redirectTo = normalizeRedirectTo(
					url.searchParams.get('redirectTo'),
				)
				const redirectTarget = redirectTo ?? '/account'
				return Response.redirect(new URL(redirectTarget, request.url), 302)
			}

			return render(Layout({}))
		},
	}
}
