import { type AppLoaderData } from '#shared/loader-data.ts'

export class RouteLoaderRedirect {
	readonly to: string

	constructor(to: string) {
		this.to = to
	}
}

export function routeLoaderRedirect(to: string) {
	return new RouteLoaderRedirect(to)
}

export function isRouteLoaderRedirect(
	value: unknown,
): value is RouteLoaderRedirect {
	return value instanceof RouteLoaderRedirect
}

export type RouteLoaderResult = Partial<AppLoaderData> | RouteLoaderRedirect

export type RouteLoader = (
	url: URL,
	signal: AbortSignal,
) => Promise<RouteLoaderResult>
