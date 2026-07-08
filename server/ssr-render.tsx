/** @jsxImportSource remix/ui */
/** @jsxRuntime automatic */
import { type RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'
import { type AppEnv } from '#types/env-schema.ts'
import { readAuthSessionResult, setAuthSessionSecret } from './auth-session.ts'
import { SsrDocument } from './ssr-document.tsx'

export type RenderAppPageInput = {
	request: Request
	appEnv: AppEnv
	title?: string
	notFound?: boolean
	status?: number
}

function getRequestUrl(request: Request) {
	const url = new URL(request.url)
	return `${url.pathname}${url.search}`
}

export async function renderAppPage(input: RenderAppPageInput) {
	const { request, appEnv, title, notFound, status } = input

	setAuthSessionSecret(appEnv.COOKIE_SECRET)
	const { session, setCookie } = await readAuthSessionResult(request)
	const stream = renderToStream(
		(
			<SsrDocument
				title={title}
				url={getRequestUrl(request)}
				session={session ? { email: session.email } : null}
				notFound={notFound === true}
			/>
		) as RemixNode,
		{
			frameSrc: request.url,
			onError(error) {
				console.error('SSR render error:', error)
			},
		},
	)

	const headers = new Headers({
		'Cache-Control': 'no-store',
		'Content-Type': 'text/html; charset=utf-8',
	})
	if (setCookie) {
		headers.append('Set-Cookie', setCookie)
	}

	return new Response(stream, {
		status: status ?? 200,
		headers,
	})
}
