import { type Handle } from 'remix/component'

type RouterSetup = {
	routes: Record<string, JSX.Element>
	fallback?: JSX.Element
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
let routerInitialized = false

function notify() {
	routerEvents.dispatchEvent(new Event('navigate'))
}

function getNavigationApi() {
	if (typeof window === 'undefined') return null
	return (window as Window & { navigation?: RouterNavigation }).navigation ?? null
}

function isSameOriginUrl(url: URL) {
	return url.origin === window.location.origin
}

function compileRoutePattern(pattern: string) {
	const regexPattern = pattern
		.replace(/:([^/]+)/g, '([^/]+)')
		.replace(/\*/g, '.*')

	return {
		pattern: new RegExp(`^${regexPattern}$`),
	}
}

function matchRoute(
	path: string,
	routes: Record<string, JSX.Element>,
): JSX.Element | null {
	for (const [pattern, routeElement] of Object.entries(routes)) {
		const { pattern: compiled } = compileRoutePattern(pattern)
		const result = compiled.exec(path)
		if (!result) continue
		return routeElement
	}

	return null
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

function navigateWithRefreshForSamePath(destination: URL) {
	if (
		getPathWithSearchAndHashFromUrl(destination) ===
		getCurrentPathWithSearchAndHash()
	) {
		notify()
		return
	}
	navigate(destination.toString())
}

async function submitPostFormThroughRouter(details: FormSubmitDetails) {
	const init: RequestInit = {
		method: details.method.toUpperCase(),
		credentials: 'include',
		redirect: 'follow',
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

	const destination = await submitPostFormThroughRouter(details)
	navigateWithRefreshForSamePath(destination)
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
	void submitFormThroughRouter(details).catch((error: unknown) => {
		console.error('Router form submit failed', error)
	})
}

function shouldInterceptNavigationEvent(event: RouterNavigateEvent) {
	if (typeof window === 'undefined') return false
	if (!event.canIntercept) return false
	if (event.downloadRequest !== null) return false
	if (event.hashChange) return false
	if (event.navigationType === 'reload') return false

	const destination = new URL(event.destination.url, window.location.href)
	if (!isSameOriginUrl(destination)) return false
	return true
}

function handleNavigationEvent(event: RouterNavigateEvent) {
	if (!shouldInterceptNavigationEvent(event)) return

	const { form } = getFormForSourceElement(event.sourceElement)
	if (form) {
		// Keep form submissions on the submit-handler path until precommit
		// handling is consistently supported across Navigation API browsers.
		return
	}

	event.intercept({
		handler() {
			notify()
		},
	})
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

	window.addEventListener('popstate', notify)
	document.addEventListener('click', handleDocumentClick)
}

export function listenToRouterNavigation(handle: Handle, listener: () => void) {
	ensureRouter()
	handle.on(routerEvents, {
		navigate: () => listener(),
	})
}

export function getPathname() {
	if (typeof window === 'undefined') return '/'
	return window.location.pathname
}

function getCurrentPathWithSearchAndHash() {
	if (typeof window === 'undefined') return '/'
	return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function navigate(to: string) {
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
		navigationApi.navigate(nextPath)
		return
	}

	window.history.pushState({}, '', nextPath)
	notify()
}

export function Router(handle: Handle, setup: RouterSetup) {
	listenToRouterNavigation(handle, () => {
		void handle.update()
	})

	return () => {
		const path = getPathname()
		const routeElement = matchRoute(path, setup.routes)
		if (routeElement) return routeElement
		return setup.fallback ?? null
	}
}
