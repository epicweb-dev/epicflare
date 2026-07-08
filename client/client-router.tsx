import { addEventListeners, type Handle } from 'remix/ui'
import { createMultiMatcher } from 'remix/route-pattern/match'
import {
	markNavigationDataStale,
	setPreloadedNavigationData,
} from './navigation-data.ts'
import {
	isRouteLoaderRedirect,
	type RouteLoader,
	type RouteLoaderResult,
} from './route-loader.ts'
import {
	readRouterPathname,
	readRouterUrl,
	readSsrRouterUrl,
} from './router-location.tsx'

type RouterSetup = {
	routes: Record<string, JSX.Element>
	fallback?: JSX.Element
	loaders?: Record<string, RouteLoader>
	notFound?: boolean
}

type FormMethod = 'get' | 'post'

type RouterNavigationHistory = 'push' | 'replace'

type RouterNavigationNavigateOptions = {
	history?: 'auto' | RouterNavigationHistory
	state?: unknown
}

type RouterNavigationNavigateResult = {
	committed: Promise<unknown>
	finished: Promise<unknown>
}

type RouterNavigateEvent = Event & {
	canIntercept: boolean
	destination: {
		url: string
	}
	downloadRequest: string | null
	formData: FormData | null
	hashChange: boolean
	intercept(options?: {
		focusReset?: 'after-transition' | 'manual'
		handler?: () => void | Promise<void>
		scroll?: 'after-transition' | 'manual'
	}): void
	navigationType: 'push' | 'replace' | 'reload' | 'traverse'
	sourceElement: Element | null
}

type RouterNavigation = EventTarget & {
	addEventListener(
		type: 'navigate',
		listener: (event: RouterNavigateEvent) => void,
		options?: AddEventListenerOptions | boolean,
	): void
	navigate(
		url: string,
		options?: RouterNavigationNavigateOptions,
	): RouterNavigationNavigateResult
}

type FormSubmitDetails = {
	action: URL
	method: FormMethod
	enctype: string
	formData: FormData
}

export const routerEvents = new EventTarget()
const clientRouteOrigin = 'https://epicflare.local'
const routeMatchers = new WeakMap<
	Record<string, JSX.Element>,
	ReturnType<typeof createRouteMatcher>
>()
const routeLoaderMatchers = new WeakMap<
	Record<string, RouteLoader>,
	ReturnType<typeof createRouteLoaderMatcher>
>()
let routerInitialized = false
let activeRouteLoaders: Record<string, RouteLoader> | null = null
let pendingProgrammaticNavigationPath: string | null = null
let pendingProgrammaticNavigationSuppressStart = false
let navigationAbortController: AbortController | null = null

function notify() {
	routerEvents.dispatchEvent(new Event('navigate'))
}

function dispatchNavigationStart() {
	routerEvents.dispatchEvent(
		new CustomEvent('navigationstart', {
			detail: { location: getCurrentPathWithSearchAndHash() },
		}),
	)
}

function dispatchNavigationEnd(location = getCurrentPathWithSearchAndHash()) {
	routerEvents.dispatchEvent(
		new CustomEvent('navigationend', {
			detail: { location },
		}),
	)
}

function beginNavigation(options: { suppressStart?: boolean } = {}) {
	navigationAbortController?.abort()
	const controller = new AbortController()
	navigationAbortController = controller
	if (!options.suppressStart) {
		dispatchNavigationStart()
	}
	return controller
}

function finishNavigation(controller: AbortController, location?: string) {
	if (navigationAbortController !== controller) return
	navigationAbortController = null
	if (!controller.signal.aborted) {
		dispatchNavigationEnd(location)
	}
}

function getNavigationApi() {
	if (typeof window === 'undefined') return null
	return (
		(window as Window & { navigation?: RouterNavigation }).navigation ?? null
	)
}

function isSameOriginUrl(url: URL) {
	return url.origin === window.location.origin
}

function createRouteMatcher(routes: Record<string, JSX.Element>) {
	const matcher = createMultiMatcher<JSX.Element>()
	for (const [pattern, routeElement] of Object.entries(routes)) {
		matcher.add(pattern, routeElement)
	}
	return matcher
}

function createRouteLoaderMatcher(loaders: Record<string, RouteLoader>) {
	const matcher = createMultiMatcher<RouteLoader>()
	for (const [pattern, loader] of Object.entries(loaders)) {
		matcher.add(pattern, loader)
	}
	return matcher
}

function getRouteMatcher(routes: Record<string, JSX.Element>) {
	const existing = routeMatchers.get(routes)
	if (existing) return existing
	const matcher = createRouteMatcher(routes)
	routeMatchers.set(routes, matcher)
	return matcher
}

function getRouteLoaderMatcher(loaders: Record<string, RouteLoader>) {
	const existing = routeLoaderMatchers.get(loaders)
	if (existing) return existing
	const matcher = createRouteLoaderMatcher(loaders)
	routeLoaderMatchers.set(loaders, matcher)
	return matcher
}

export function matchRoute(
	path: string,
	routes: Record<string, JSX.Element>,
): JSX.Element | null {
	return (
		getRouteMatcher(routes).match(new URL(path, clientRouteOrigin))?.data ??
		null
	)
}

function matchRouteLoader(path: string) {
	if (!activeRouteLoaders) return null
	return (
		getRouteLoaderMatcher(activeRouteLoaders).match(
			new URL(path, clientRouteOrigin),
		)?.data ?? null
	)
}

function shouldHandleClick(event: MouseEvent, anchor: HTMLAnchorElement) {
	if (event.defaultPrevented) return false
	if (event.button !== 0) return false
	if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
		return false
	if (anchor.target && anchor.target !== '_self') return false
	if (anchor.hasAttribute('download')) return false

	const href = anchor.getAttribute('href')
	if (!href || href.startsWith('#')) return false

	const destination = new URL(href, window.location.href)
	if (destination.origin !== window.location.origin) return false
	return true
}

function handleDocumentClick(event: MouseEvent) {
	const target = event.target as Element | null
	const anchor = target?.closest('a') as HTMLAnchorElement | null
	if (!anchor || typeof window === 'undefined') return
	if (!shouldHandleClick(event, anchor)) return

	event.preventDefault()
	const destination = new URL(anchor.href, window.location.href)
	navigate(`${destination.pathname}${destination.search}${destination.hash}`)
}

function getFormSubmitter(event: SubmitEvent) {
	const submitter = event.submitter
	if (
		submitter instanceof HTMLButtonElement ||
		submitter instanceof HTMLInputElement
	) {
		return submitter
	}
	return null
}

function normalizeFormMethod(rawMethod: string | null): FormMethod | null {
	const method = (rawMethod ?? 'get').trim().toLowerCase()
	if (method === 'get' || method === 'post') return method
	return null
}

function normalizeTarget(rawTarget: string | null) {
	return (rawTarget ?? '').trim().toLowerCase()
}

function getFormForSourceElement(sourceElement: Element | null) {
	if (sourceElement instanceof HTMLFormElement) {
		return {
			form: sourceElement,
			submitter: null,
		}
	}
	if (
		sourceElement instanceof HTMLButtonElement ||
		sourceElement instanceof HTMLInputElement
	) {
		return {
			form: sourceElement.form,
			submitter: sourceElement,
		}
	}
	return {
		form: null,
		submitter: null,
	}
}

function createSubmitFormData(
	form: HTMLFormElement,
	submitter: HTMLButtonElement | HTMLInputElement | null,
) {
	return submitter ? new FormData(form, submitter) : new FormData(form)
}

function resolveFormSubmitDetails(
	form: HTMLFormElement,
	submitter: HTMLButtonElement | HTMLInputElement | null,
): FormSubmitDetails | null {
	const method = normalizeFormMethod(
		submitter?.getAttribute('formmethod') ?? form.getAttribute('method'),
	)
	if (!method) return null

	const target = normalizeTarget(
		submitter?.getAttribute('formtarget') ?? form.getAttribute('target'),
	)
	if (target && target !== '_self') return null

	const rawAction =
		submitter?.getAttribute('formaction') ?? form.getAttribute('action')
	const action = new URL(
		rawAction || window.location.href,
		window.location.href,
	)
	if (action.origin !== window.location.origin) return null

	const enctype = (
		submitter?.getAttribute('formenctype') ??
		form.getAttribute('enctype') ??
		'application/x-www-form-urlencoded'
	)
		.trim()
		.toLowerCase()

	return {
		action,
		method,
		enctype,
		formData: createSubmitFormData(form, submitter),
	}
}

function formDataToSearchParams(formData: FormData) {
	const params = new URLSearchParams()
	for (const [name, value] of formData.entries()) {
		params.append(name, getFormDataValueText(value))
	}
	return params
}

function formDataToPlainText(formData: FormData) {
	const lines: Array<string> = []
	for (const [name, value] of formData.entries()) {
		lines.push(`${name}=${getFormDataValueText(value)}`)
	}
	return lines.join('\r\n')
}

function getFormDataValueText(value: FormDataEntryValue) {
	if (typeof value === 'string') return value
	const fileName = (value as { name?: unknown }).name
	return typeof fileName === 'string' ? fileName : 'blob'
}

function buildGetDestination(action: URL, formData: FormData) {
	const destination = new URL(action.toString())
	destination.search = formDataToSearchParams(formData).toString()
	return destination
}

function getPathWithSearchAndHashFromUrl(url: URL) {
	return `${url.pathname}${url.search}${url.hash}`
}

function consumeProgrammaticNavigation(path: string) {
	if (pendingProgrammaticNavigationPath !== path) {
		return { matched: false, suppressStart: false }
	}
	const suppressStart = pendingProgrammaticNavigationSuppressStart
	pendingProgrammaticNavigationPath = null
	pendingProgrammaticNavigationSuppressStart = false
	return { matched: true, suppressStart }
}

async function preloadRouteData(destination: URL, signal: AbortSignal) {
	const path = getPathWithSearchAndHashFromUrl(destination)
	const loader = matchRouteLoader(path)
	if (!loader) return null
	return loader(destination, signal)
}

function commitRouteLoaderResult(
	destination: URL,
	result: RouteLoaderResult | null,
) {
	const path = getPathWithSearchAndHashFromUrl(destination)
	if (!result) return false
	if (isRouteLoaderRedirect(result)) {
		window.location.assign(result.to)
		return true
	}
	if (Object.keys(result).length > 0) {
		setPreloadedNavigationData(path, result)
	}
	return false
}

async function preloadAndCommitNavigationData(
	destination: URL,
	signal: AbortSignal,
) {
	try {
		const result = await preloadRouteData(destination, signal)
		if (signal.aborted) return false
		return commitRouteLoaderResult(destination, result)
	} catch (error) {
		if (signal.aborted) return false
		markNavigationDataStale(getPathWithSearchAndHashFromUrl(destination))
		console.error('Route loader failed', error)
		return false
	}
}

async function navigateWithRefreshForSamePath(
	destination: URL,
	options: { signal?: AbortSignal; suppressStart?: boolean } = {},
) {
	const path = getPathWithSearchAndHashFromUrl(destination)
	if (path === getCurrentPathWithSearchAndHash()) {
		const controller = options.signal
			? null
			: beginNavigation({ suppressStart: options.suppressStart })
		const redirected = await preloadAndCommitNavigationData(
			destination,
			options.signal ?? controller?.signal ?? new AbortController().signal,
		)
		if (!redirected) notify()
		if (controller) {
			finishNavigation(controller, path)
		}
		return
	}
	navigate(destination.toString(), { suppressStart: options.suppressStart })
}

async function submitPostFormThroughRouter(
	details: FormSubmitDetails,
	signal?: AbortSignal,
) {
	const init: RequestInit = {
		method: details.method.toUpperCase(),
		credentials: 'include',
		redirect: 'follow',
		signal,
	}

	if (details.enctype === 'application/x-www-form-urlencoded') {
		init.body = formDataToSearchParams(details.formData)
		init.headers = {
			'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
		}
	} else if (details.enctype === 'text/plain') {
		init.body = formDataToPlainText(details.formData)
		init.headers = {
			'Content-Type': 'text/plain;charset=UTF-8',
		}
	} else {
		init.body = details.formData
	}

	const response = await fetch(details.action.toString(), init)
	if (response.redirected) {
		return new URL(response.url, window.location.href)
	}

	const location = response.headers.get('Location')
	if (location) {
		return new URL(location, details.action)
	}

	throw new Error(
		`Expected redirect location after form submit (${response.status} ${response.statusText})`,
	)
}

async function submitFormThroughRouter(details: FormSubmitDetails) {
	if (details.method === 'get') {
		navigate(buildGetDestination(details.action, details.formData).toString())
		return
	}

	const controller = beginNavigation()
	try {
		const destination = await submitPostFormThroughRouter(
			details,
			controller.signal,
		)
		if (controller.signal.aborted) return
		await navigateWithRefreshForSamePath(destination, {
			signal: controller.signal,
			suppressStart: true,
		})
		finishNavigation(controller, getPathWithSearchAndHashFromUrl(destination))
	} catch (error) {
		if (!controller.signal.aborted) {
			console.error('Router form submit failed', error)
			finishNavigation(controller)
		}
	}
}

function handleDocumentSubmit(event: Event) {
	if (!(event instanceof SubmitEvent)) return
	if (typeof window === 'undefined') return
	if (event.defaultPrevented) return
	if (!(event.target instanceof HTMLFormElement)) return
	if (event.target.hasAttribute('data-router-skip')) return

	const submitter = getFormSubmitter(event)
	const details = resolveFormSubmitDetails(event.target, submitter)
	if (!details) return

	event.preventDefault()
	void submitFormThroughRouter(details)
}

function shouldInterceptNavigationEvent(event: RouterNavigateEvent) {
	if (typeof window === 'undefined') return false
	if (!event.canIntercept) return false
	if (event.downloadRequest !== null) return false
	if (event.navigationType === 'reload') return false

	const destination = new URL(event.destination.url, window.location.href)
	if (!isSameOriginUrl(destination)) return false
	return true
}

function handleNavigationEvent(event: RouterNavigateEvent) {
	if (!shouldInterceptNavigationEvent(event)) return

	if (event.hashChange) {
		event.intercept({
			handler() {
				const controller = beginNavigation()
				notify()
				finishNavigation(
					controller,
					getPathWithSearchAndHashFromUrl(
						new URL(event.destination.url, window.location.href),
					),
				)
			},
		})
		return
	}

	const { form } = getFormForSourceElement(event.sourceElement)
	if (form) {
		// Keep form submissions on the submit-handler path until precommit
		// handling is consistently supported across Navigation API browsers.
		return
	}
	const destination = new URL(event.destination.url, window.location.href)
	const nextPath = getPathWithSearchAndHashFromUrl(destination)
	const programmaticNavigation = consumeProgrammaticNavigation(nextPath)
	const controller = programmaticNavigation.matched
		? beginNavigation({
				suppressStart: programmaticNavigation.suppressStart,
			})
		: beginNavigation()

	event.intercept({
		async handler() {
			if (programmaticNavigation.matched) {
				notify()
				finishNavigation(controller, nextPath)
				return
			}
			const redirected = await preloadAndCommitNavigationData(
				destination,
				controller.signal,
			)
			if (controller.signal.aborted) return
			if (!redirected) {
				notify()
			}
			finishNavigation(controller, nextPath)
		},
	})
}

function handlePopstate() {
	const controller = beginNavigation()
	notify()
	finishNavigation(controller)
}

function ensureRouter() {
	if (routerInitialized) return
	routerInitialized = true

	document.addEventListener('submit', handleDocumentSubmit)

	const navigationApi = getNavigationApi()
	if (navigationApi) {
		navigationApi.addEventListener('navigate', handleNavigationEvent)
		return
	}

	window.addEventListener('popstate', handlePopstate)
	document.addEventListener('click', handleDocumentClick)
}

export function listenToRouterNavigation(
	handle: Pick<Handle, 'signal'>,
	listener: () => void,
) {
	if (typeof document === 'undefined') return
	ensureRouter()
	addEventListeners(routerEvents, handle.signal, {
		navigate: () => listener(),
	})
}

export function getPathname(handle?: Pick<Handle, 'context'>) {
	if (handle) {
		try {
			return readRouterPathname(handle)
		} catch {
			// Router location context is unavailable outside the app tree.
		}
	}
	if (typeof window === 'undefined') return '/'
	return window.location.pathname
}

function getCurrentPathWithSearchAndHash() {
	if (typeof window === 'undefined') return '/'
	return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function navigate(
	to: string,
	options: { suppressStart?: boolean } = {},
) {
	if (typeof window === 'undefined') return
	const destination = new URL(to, window.location.href)
	if (destination.origin !== window.location.origin) {
		window.location.assign(destination.toString())
		return
	}

	const nextPath = `${destination.pathname}${destination.search}${destination.hash}`
	if (nextPath === getCurrentPathWithSearchAndHash()) return

	const navigationApi = getNavigationApi()
	if (navigationApi) {
		pendingProgrammaticNavigationPath = nextPath
		pendingProgrammaticNavigationSuppressStart = options.suppressStart === true
		navigationApi.navigate(nextPath)
		return
	}

	const controller = beginNavigation({ suppressStart: options.suppressStart })
	window.history.pushState({}, '', nextPath)
	notify()
	finishNavigation(controller, nextPath)
}

type RouterHandle = Pick<Handle, 'context' | 'signal' | 'update'> & {
	props: RouterSetup
}

function normalizeHref(href: string) {
	const url = new URL(href, clientRouteOrigin)
	return `${url.pathname}${url.search}${url.hash}`
}

function isOnSsrUrl(handle: Pick<Handle, 'context'>) {
	return (
		normalizeHref(readRouterUrl(handle)) ===
		normalizeHref(readSsrRouterUrl(handle))
	)
}

export function Router(handle: RouterHandle) {
	activeRouteLoaders = handle.props.loaders ?? null
	if (typeof document !== 'undefined') {
		listenToRouterNavigation(handle, () => {
			void handle.update()
		})
	}

	return () => {
		if (handle.props.notFound && isOnSsrUrl(handle)) {
			return handle.props.fallback ?? null
		}

		const path = getPathname(handle)
		const routeElement = matchRoute(path, handle.props.routes)
		if (routeElement) return routeElement
		return handle.props.fallback ?? null
	}
}
