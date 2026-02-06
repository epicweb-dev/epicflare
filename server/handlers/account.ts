import { type BuildAction } from 'remix/fetch-router'
import { html } from 'remix/html-template'
import { readAuthSession } from '../auth-session.ts'
import { redirectToLogin } from '../auth-redirect.ts'
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
				You are signed in to epicflare.
			</p>
			<form method="post" action="/logout" style="margin: 0;">
				<button
					type="submit"
					style="padding: var(--spacing-sm) var(--spacing-lg); border-radius: var(--radius-full); border: none; background: var(--color-primary); color: var(--color-on-primary); font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); cursor: pointer;"
				>
					Log out
				</button>
			</form>
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
			return redirectToLogin(request)
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
