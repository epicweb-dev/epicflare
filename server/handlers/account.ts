import { type BuildAction } from 'remix/fetch-router'
import { html } from 'remix/html-template'
import { readAuthSession } from '../auth-session.ts'
import { Layout } from '../layout.ts'
import { render } from '../render.ts'
import type routes from '../routes.ts'

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

function renderAccount(email: string) {
	return html`<main
		style="max-width: 52rem; margin: 0 auto; padding: var(--spacing-page); font-family: var(--font-family);"
	>
		<section style="display: grid; gap: var(--spacing-md);">
			<h1
				style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); margin: 0;"
			>
				Welcome, ${escapeHtml(email)}
			</h1>
			<p style="margin: 0; color: var(--color-text-muted);">
				You are signed in to Epicflare.
			</p>
			<a
				href="/"
				style="color: var(--color-primary); font-weight: var(--font-weight-medium); text-decoration: none;"
			>
				Back home
			</a>
		</section>
	</main>`
}

export default {
	middleware: [],
	async action({ request }) {
		const session = await readAuthSession(request)

		if (!session) {
			return Response.redirect(new URL('/login', request.url), 302)
		}

		return render(
			Layout({
				title: 'Welcome',
				entryScripts: false,
				children: renderAccount(session.email),
			}),
		)
	},
} satisfies BuildAction<
	typeof routes.account.method,
	typeof routes.account.pattern
>
