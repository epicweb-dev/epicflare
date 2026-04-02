/// <reference types="bun" />
import { expect, test, vi } from 'vitest'
import { type Handle } from 'remix/component'

type QueueTask = Parameters<Handle['queueTask']>[0]

const navigationListeners: Array<() => void> = []
const queuedSessionResponses: Array<{ email: string } | null> = []
const fetchSessionInfoMock = vi.fn(async () => {
	return queuedSessionResponses.shift() ?? null
})

async function loadApp() {
	vi.resetModules()
	vi.doMock('./client-router.tsx', () => ({
		routerEvents: new EventTarget(),
		listenToRouterNavigation: (_handle: Handle, listener: () => void) => {
			navigationListeners.push(listener)
		},
		getPathname: () => '/',
		navigate: () => {
			return
		},
		Router: () => () => null,
	}))
	vi.doMock('./session.ts', () => ({
		fetchSessionInfo: fetchSessionInfoMock,
	}))
	const { App } = await import('./app.tsx')
	return App
}

async function runNextTask(tasks: Array<QueueTask>, aborted: boolean) {
	const task = tasks.shift()
	expect(task).toBeDefined()
	const controller = new AbortController()
	if (aborted) controller.abort()
	await task!(controller.signal)
}

test('aborted refresh does not erase a ready authenticated session', async () => {
	navigationListeners.length = 0
	queuedSessionResponses.length = 0
	queuedSessionResponses.push({ email: 'signed-in@example.com' }, null)
	fetchSessionInfoMock.mockClear()

	const queuedTasks: Array<QueueTask> = []
	const handle = {
		queueTask(task: QueueTask) {
			queuedTasks.push(task)
		},
		async update() {
			return new AbortController().signal
		},
		on() {
			return
		},
	} as unknown as Handle

	const App = await loadApp()
	const render = App(handle)
	expect(navigationListeners).toHaveLength(1)

	// Initial bootstrap task enqueues the session fetch.
	await runNextTask(queuedTasks, false)
	await runNextTask(queuedTasks, false)

	const authenticatedUi = render()
	const navChildren = (authenticatedUi.props as { children: Array<unknown> })
		.children[0] as {
		props: { children: Array<unknown> }
	}
	const navItems = navChildren.props.children as Array<unknown>
	const accountLink = navItems[2] as { props?: { children?: Array<unknown> } }
	const accountEntry = (accountLink.props?.children ?? [])[1] as {
		props?: { children?: string }
	}
	const logoutEntry = (accountLink.props?.children ?? [])[2] as {
		props?: { children?: { props?: { children?: string } } }
	}
	expect(accountEntry.props?.children).toBe('signed-in@example.com')
	expect(logoutEntry.props?.children?.props?.children).toBe('Log out')

	// Re-run refresh via navigation, then abort in-flight fetch.
	navigationListeners[0]!()
	await runNextTask(queuedTasks, true)

	const uiAfterAbort = render()
	const navAfterAbort = (uiAfterAbort.props as { children: Array<unknown> })
		.children[0] as {
		props: { children: Array<unknown> }
	}
	const navAfterAbortItems = navAfterAbort.props.children as Array<unknown>
	expect(navAfterAbortItems).toHaveLength(3)
	const accountLinkAfterAbort = navAfterAbortItems[2] as {
		props?: { children?: Array<unknown> }
	}
	const accountEntryAfterAbort = (accountLinkAfterAbort.props?.children ?? [])[1] as {
		props?: { children?: string }
	}
	const logoutEntryAfterAbort = (accountLinkAfterAbort.props?.children ?? [])[2] as {
		props?: { children?: { props?: { children?: string } } }
	}
	expect(accountEntryAfterAbort.props?.children).toBe('signed-in@example.com')
	expect(logoutEntryAfterAbort.props?.children?.props?.children).toBe('Log out')

	vi.doUnmock('./client-router.tsx')
	vi.doUnmock('./session.ts')
})
