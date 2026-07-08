/** @jsxImportSource remix/ui */
/** @jsxRuntime automatic */
import { type Handle } from 'remix/ui'
import {
	APP_ROOT_ENTRY_ID,
	AppRoot,
	type AppRootProps,
} from '#client/app-root.tsx'

export type SsrDocumentProps = AppRootProps & {
	title?: string
}

const clientEntryHref = APP_ROOT_ENTRY_ID.split('#')[0] ?? '/client-entry.js'

export function SsrDocument(handle: Handle<SsrDocumentProps>) {
	return () => (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.ico" sizes="any" />
				<link
					rel="icon"
					type="image/png"
					sizes="32x32"
					href="/favicon-32x32.png"
				/>
				<link
					rel="icon"
					type="image/png"
					sizes="16x16"
					href="/favicon-16x16.png"
				/>
				<link
					rel="apple-touch-icon"
					sizes="180x180"
					href="/apple-touch-icon.png"
				/>
				<link rel="manifest" href="/site.webmanifest" />
				<meta name="theme-color" content="#f47c00" />
				<title>{handle.props.title ?? 'epicflare'}</title>
				<link rel="modulepreload" href={clientEntryHref} />
				<link rel="stylesheet" href="/styles.css" />
			</head>
			<body>
				<div id="root">
					<AppRoot
						url={handle.props.url}
						session={handle.props.session}
						notFound={handle.props.notFound === true}
					/>
				</div>
				<script type="module" src={clientEntryHref}></script>
			</body>
		</html>
	)
}
