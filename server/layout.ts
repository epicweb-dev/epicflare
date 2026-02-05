import { html, type SafeHtml } from 'remix/html-template'

const defaultEntryScripts: Array<string> = ['/client-entry.js']
const defaultShell = html`<div class="app-shell">
	<div
		class="loading-spinner"
		role="status"
		aria-live="polite"
		aria-label="Loading"
	></div>
</div>`

export function Layout({
	children,
	title = 'Epicflare',
	entryScripts = defaultEntryScripts,
}: {
	children?: SafeHtml
	title?: string
	entryScripts?: Array<string> | false
}) {
	const scripts = entryScripts === false ? [] : entryScripts
	const shell = children ?? defaultShell
	return html`<html lang="en">
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<title>${title}</title>
			<link rel="stylesheet" href="/styles.css" />
		</head>
		<body>
			<div id="root">${shell}</div>
			${scripts.map(
				(script) => html`<script type="module" src="${script}"></script>`,
			)}
		</body>
	</html>`
}
