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

afterEach(() => {
	vi.resetModules()
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
