import { afterEach, expect, test, vi } from 'vitest'
import { type Handle } from 'remix/component'

type TestWindow = Window &
	typeof globalThis & {
		navigation?: EventTarget & {
			navigate?: (url: string) => {
				committed: Promise<unknown>
				finished: Promise<unknown>
			}
		}
	}

const originalWindow = globalThis.window
const originalFetch = globalThis.fetch
const originalHtmlFormElement = globalThis.HTMLFormElement
const originalHtmlButtonElement = globalThis.HTMLButtonElement
const originalHtmlInputElement = globalThis.HTMLInputElement

afterEach(() => {
	vi.resetModules()
	globalThis.fetch = originalFetch
	if (originalHtmlFormElement) {
		globalThis.HTMLFormElement = originalHtmlFormElement
	} else {
		Reflect.deleteProperty(globalThis, 'HTMLFormElement')
	}
	if (originalHtmlButtonElement) {
		globalThis.HTMLButtonElement = originalHtmlButtonElement
	} else {
		Reflect.deleteProperty(globalThis, 'HTMLButtonElement')
	}
	if (originalHtmlInputElement) {
		globalThis.HTMLInputElement = originalHtmlInputElement
	} else {
		Reflect.deleteProperty(globalThis, 'HTMLInputElement')
	}
	if (originalWindow) {
		globalThis.window = originalWindow
		return
	}
	Reflect.deleteProperty(globalThis, 'window')
})

async function loadClientRouter() {
	return import('./client-router.tsx')
}

test('navigate uses the Navigation API when available', async () => {
	const historyPushState = vi.fn()
	const navigationNavigate = vi.fn(() => ({
		committed: Promise.resolve(),
		finished: Promise.resolve(),
	}))

	globalThis.window = {
		history: {
			pushState: historyPushState,
		},
		location: {
			assign: vi.fn(),
			hash: '',
			href: 'https://example.com/',
			origin: 'https://example.com',
			pathname: '/',
			search: '',
		},
		navigation: {
			navigate: navigationNavigate,
		},
	} as unknown as TestWindow

	const { navigate } = await loadClientRouter()
	navigate('/login?redirectTo=%2Faccount#start')

	expect(navigationNavigate).toHaveBeenCalledWith('/login?redirectTo=%2Faccount#start')
	expect(historyPushState).not.toHaveBeenCalled()
})

test('listenToRouterNavigation rerenders for intercepted Navigation API events', async () => {
	const navigationEventTarget = new EventTarget()
	const listenerCalls: Array<string> = []

	globalThis.window = {
		location: {
			assign: vi.fn(),
			hash: '',
			href: 'https://example.com/',
			origin: 'https://example.com',
			pathname: '/',
			search: '',
		},
		navigation: {
			addEventListener: navigationEventTarget.addEventListener.bind(
				navigationEventTarget,
			),
			dispatchEvent: navigationEventTarget.dispatchEvent.bind(navigationEventTarget),
			navigate: vi.fn(() => ({
				committed: Promise.resolve(),
				finished: Promise.resolve(),
			})),
		},
	} as unknown as TestWindow

	const { listenToRouterNavigation } = await loadClientRouter()
	const handle = {
		on(target: EventTarget, listeners: Record<string, () => void>) {
			for (const [eventName, eventListener] of Object.entries(listeners)) {
				target.addEventListener(eventName, () => {
					eventListener()
				})
			}
		},
	} as unknown as Handle

	listenToRouterNavigation(handle, () => {
		listenerCalls.push('navigate')
	})

	let intercepted = false
	const event = Object.assign(new Event('navigate'), {
		canIntercept: true,
		destination: {
			url: 'https://example.com/login',
		},
		downloadRequest: null,
		formData: null,
		hashChange: false,
		intercept(options?: { handler?: () => void | Promise<void> }) {
			intercepted = true
			options?.handler?.()
		},
		navigationType: 'push' as const,
		sourceElement: null,
	})

	;(globalThis.window as TestWindow).navigation!.dispatchEvent(event)

	expect(intercepted).toBe(true)
	expect(listenerCalls).toEqual(['navigate'])
})

test('reload navigations are not intercepted', async () => {
	const navigationEventTarget = new EventTarget()
	const locationAssign = vi.fn()

	globalThis.window = {
		location: {
			assign: locationAssign,
			hash: '',
			href: 'https://example.com/account',
			origin: 'https://example.com',
			pathname: '/account',
			search: '',
		},
		navigation: {
			addEventListener: navigationEventTarget.addEventListener.bind(
				navigationEventTarget,
			),
			dispatchEvent: navigationEventTarget.dispatchEvent.bind(navigationEventTarget),
			navigate: vi.fn(() => ({
				committed: Promise.resolve(),
				finished: Promise.resolve(),
			})),
		},
	} as unknown as TestWindow

	const { listenToRouterNavigation } = await loadClientRouter()
	const handle = {
		on(target: EventTarget, listeners: Record<string, () => void>) {
			for (const [eventName, eventListener] of Object.entries(listeners)) {
				target.addEventListener(eventName, () => {
					eventListener()
				})
			}
		},
	} as unknown as Handle

	let notified = false
	listenToRouterNavigation(handle, () => {
		notified = true
	})

	let intercepted = false
	const event = Object.assign(new Event('navigate'), {
		canIntercept: true,
		destination: {
			url: 'https://example.com/account',
		},
		downloadRequest: null,
		formData: null,
		hashChange: false,
		intercept() {
			intercepted = true
		},
		navigationType: 'reload' as const,
		sourceElement: null,
	})

	;(globalThis.window as TestWindow).navigation!.dispatchEvent(event)

	expect(intercepted).toBe(false)
	expect(notified).toBe(false)
	expect(locationAssign).not.toHaveBeenCalled()
})

test('cross-origin post redirects fall back to document navigation', async () => {
	const navigationEventTarget = new EventTarget()
	const locationAssign = vi.fn()
	const fetchMock = vi.fn(async () => {
		return {
			redirected: true,
			headers: new Headers(),
			status: 302,
			statusText: 'Found',
			url: 'https://oauth.example.com/authorize',
		}
	})

	globalThis.fetch = fetchMock as unknown as typeof fetch
	class MockHtmlFormElement {}
	class MockHtmlButtonElement {}
	class MockHtmlInputElement {}
	globalThis.HTMLFormElement =
		MockHtmlFormElement as unknown as typeof HTMLFormElement
	globalThis.HTMLButtonElement =
		MockHtmlButtonElement as unknown as typeof HTMLButtonElement
	globalThis.HTMLInputElement =
		MockHtmlInputElement as unknown as typeof HTMLInputElement
	globalThis.window = {
		location: {
			assign: locationAssign,
			hash: '',
			href: 'https://example.com/login',
			origin: 'https://example.com',
			pathname: '/login',
			search: '',
		},
		navigation: {
			addEventListener: navigationEventTarget.addEventListener.bind(
				navigationEventTarget,
			),
			dispatchEvent: navigationEventTarget.dispatchEvent.bind(navigationEventTarget),
			navigate: vi.fn(() => ({
				committed: Promise.resolve(),
				finished: Promise.resolve(),
			})),
		},
	} as unknown as TestWindow

	const { listenToRouterNavigation } = await loadClientRouter()
	const handle = {
		on(target: EventTarget, listeners: Record<string, () => void>) {
			for (const [eventName, eventListener] of Object.entries(listeners)) {
				target.addEventListener(eventName, () => {
					eventListener()
				})
			}
		},
	} as unknown as Handle
	listenToRouterNavigation(handle, () => {
		return
	})

	const controllerRedirect = vi.fn()
	let interceptedHandler:
		| ((controller: { redirect(url: string): void }) => Promise<void>)
		| null = null
	const form = new MockHtmlFormElement() as unknown as HTMLFormElement
	Object.assign(form, {
		getAttribute(name: string) {
			if (name === 'method') return 'post'
			if (name === 'action') return '/oauth/start'
			return null
		},
		hasAttribute() {
			return false
		},
	})

	const event = Object.assign(new Event('navigate'), {
		canIntercept: true,
		destination: {
			url: 'https://example.com/oauth/start',
		},
		downloadRequest: null,
		formData: new FormData(),
		hashChange: false,
		intercept(options?: {
			precommitHandler?: (controller: { redirect(url: string): void }) => Promise<void>
			handler?: () => void | Promise<void>
		}) {
			interceptedHandler = options?.precommitHandler ?? null
		},
		navigationType: 'push' as const,
		sourceElement: form,
	})

	;(globalThis.window as TestWindow).navigation!.dispatchEvent(event)
	expect(interceptedHandler).not.toBeNull()

	await interceptedHandler!({
		redirect: controllerRedirect,
	})

	expect(controllerRedirect).toHaveBeenCalledWith('https://example.com/login', {
		history: 'replace',
	})
	expect(locationAssign).not.toHaveBeenCalled()
})
