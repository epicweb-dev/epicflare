import { expect, test, vi } from 'vitest'

const trackedMock = vi.fn()

test('first test records mock calls', () => {
	trackedMock('first-call')

	expect(trackedMock).toHaveBeenCalledTimes(1)
	expect(trackedMock).toHaveBeenCalledWith('first-call')
})

test('second test starts with cleared mock state', () => {
	expect(trackedMock).not.toHaveBeenCalled()

	trackedMock('second-call')

	expect(trackedMock).toHaveBeenCalledTimes(1)
	expect(trackedMock).toHaveBeenCalledWith('second-call')
})
