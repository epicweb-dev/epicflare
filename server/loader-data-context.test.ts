import { type Handle } from 'remix/ui'
import { expect, test } from 'vitest'
import {
	AppLoaderDataProvider,
	tryConsumeRouteLoaderData,
} from '#client/loader-data-context.tsx'
import {
	clearPreloadedNavigationData,
	setPreloadedNavigationData,
} from '#client/navigation-data.ts'

function createStubHandle() {
	const queuedTasks: Array<() => unknown> = []
	let updateCount = 0
	const handle = {
		context: {
			get(provider: unknown) {
				if (provider === AppLoaderDataProvider) {
					return {
						loaderData: undefined,
						consumedKeys: new Set(),
					}
				}
				throw new Error('context unavailable')
			},
		},
		queueTask(task: () => unknown) {
			queuedTasks.push(task)
		},
		update() {
			updateCount++
		},
	} as unknown as Handle

	return {
		handle,
		queuedTasks,
		getUpdateCount() {
			return updateCount
		},
	}
}

test('consuming preloaded route data schedules one corrective render', () => {
	clearPreloadedNavigationData()
	setPreloadedNavigationData('/account', {
		account: {
			ok: true,
			email: 'loader@example.com',
		},
	})
	const { handle, queuedTasks, getUpdateCount } = createStubHandle()

	const consumed = tryConsumeRouteLoaderData(handle, 'account', '/account')

	expect(consumed?.email).toBe('loader@example.com')
	expect(queuedTasks).toHaveLength(1)
	for (const task of queuedTasks.splice(0)) {
		task()
	}
	expect(getUpdateCount()).toBe(1)

	const reconsumed = tryConsumeRouteLoaderData(handle, 'account', '/account')

	expect(reconsumed).toBeUndefined()
	expect(queuedTasks).toHaveLength(0)
	expect(getUpdateCount()).toBe(1)
	clearPreloadedNavigationData()
})
