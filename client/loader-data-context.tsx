import { type Handle, type RemixNode } from 'remix/ui'
import { type AppLoaderData } from '#shared/loader-data.ts'
import { tryConsumePreloadedLoaderData } from './navigation-data.ts'
import { readSsrRouterUrl } from './router-location.tsx'

export type AppLoaderDataContextValue = {
	loaderData?: AppLoaderData
	consumedKeys: Set<keyof AppLoaderData>
}

const routerHrefOrigin = 'https://epicflare.local'

function normalizeRouterHref(href: string) {
	const url = new URL(href, routerHrefOrigin)
	return `${url.pathname}${url.search}${url.hash}`
}

function hrefMatchesSsrUrl(currentHref: string, ssrUrl: string) {
	return normalizeRouterHref(currentHref) === normalizeRouterHref(ssrUrl)
}

export function AppLoaderDataProvider(
	handle: Handle<
		{ children?: RemixNode; loaderData?: AppLoaderData },
		AppLoaderDataContextValue
	>,
) {
	const consumedKeys = new Set<keyof AppLoaderData>()
	handle.context.set({
		loaderData: handle.props.loaderData,
		consumedKeys,
	})

	return () => handle.props.children
}

export function tryConsumeEmbeddedLoaderData<K extends keyof AppLoaderData>(
	handle: Handle,
	key: K,
	currentHref: string,
): AppLoaderData[K] | undefined {
	const ctx = handle.context.get(AppLoaderDataProvider)
	const embedded = ctx.loaderData?.[key]
	if (!embedded) return undefined

	let ssrUrl: string
	try {
		ssrUrl = readSsrRouterUrl(handle)
	} catch {
		return undefined
	}

	if (!hrefMatchesSsrUrl(currentHref, ssrUrl)) return undefined
	if (ctx.consumedKeys.has(key)) return undefined

	ctx.consumedKeys.add(key)
	return embedded
}

export function tryConsumeRouteLoaderData<K extends keyof AppLoaderData>(
	handle: Handle,
	key: K,
	currentHref: string,
): AppLoaderData[K] | undefined {
	const embedded = tryConsumeEmbeddedLoaderData(handle, key, currentHref)
	if (embedded !== undefined) return embedded
	return tryConsumePreloadedLoaderData(key, currentHref)
}
