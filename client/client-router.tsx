import { type Handle } from 'remix/component'

type RouteMatch = {
	path: string
	params: Record<string, string>
}

type RouteView = (match: RouteMatch) => JSX.Element

type RouterSetup = {
	routes: Record<string, RouteView>
	fallback?: RouteView
}

type FormMethod = 'get' | 'post'

type FormSubmitDetails = {
	action: URL
	method: FormMethod
	enctype: string
	formData: FormData
}

const routerEvents = new EventTarget()
let routerInitialized = false

function notify() {
	routerEvents.dispatchEvent(new Event('navigate'))
}

function compileRoutePattern(pattern: string) {
	const paramNames: Array<string> = []
	const regexPattern = pattern
		.replace(/:([^/]+)/g, (_, name) => {
			paramNames.push(name)
			return '([^/]+)'
		})
		.replace(/\*/g, '.*')

	return {
		pattern: new RegExp(`^${regexPattern}$`),
		paramNames,
	}
}

function matchRoute(
	path: string,
	routes: Record<string, RouteView>,
): { view: RouteView; match: RouteMatch } | null {
	for (const [pattern, view] of Object.entries(routes)) {
		const { pattern: compiled, paramNames } = compileRoutePattern(pattern)
		const result = compiled.exec(path)
		if (!result) continue

		const params: Record<string, string> = {}
		paramNames.forEach((name, index) => {
			const value = result[index + 1]
			if (value !== undefined) params[name] = value
		})

		return {
			view,
			match: { path, params },
		}
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
		params.append(name, typeof value === 'string' ? value : value.name)
	}
	return params
}

function formDataToPlainText(formData: FormData) {
	const lines: Array<string> = []
	for (const [name, value] of formData.entries()) {
		lines.push(`${name}=${typeof value === 'string' ? value : value.name}`)
	}
	return lines.join('\r\n')
}

function buildGetDestination(action: URL, formData: FormData) {
	const destination = new URL(action.toString())
	const searchParams = new URLSearchParams(destination.search)
	for (const [name, value] of formData.entries()) {
		searchParams.append(name, typeof value === 'string' ? value : value.name)
	}
	destination.search = searchParams.toString()
	return destination
}

async function submitFormThroughRouter(details: FormSubmitDetails) {
	if (details.method === 'get') {
		navigate(buildGetDestination(details.action, details.formData).toString())
		return
	}

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
		navigate(response.url)
		return
	}

	const location = response.headers.get('Location')
	if (location) {
		navigate(new URL(location, details.action).toString())
		return
	}

	if (response.ok) {
		notify()
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
	void submitFormThroughRouter(details).catch((error: unknown) => {
		console.error('Router form submit failed', error)
	})
}

function ensureRouter() {
	if (routerInitialized) return
	routerInitialized = true
	window.addEventListener('popstate', notify)
	document.addEventListener('click', handleDocumentClick)
	document.addEventListener('submit', handleDocumentSubmit)
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

	window.history.pushState({}, '', nextPath)
	notify()
}

export function Router(handle: Handle, setup: RouterSetup) {
	ensureRouter()
	handle.on(routerEvents, { navigate: () => void handle.update() })

	return () => {
		const path = getPathname()
		const result = matchRoute(path, setup.routes)
		if (result) {
			return result.view(result.match)
		}

		return setup.fallback ? setup.fallback({ path, params: {} }) : null
	}
}
