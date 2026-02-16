/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { readMockRequests } from '#tools/mock-api-server.ts'
import { createMockResendServer } from '#tools/mock-resend-server.ts'
import { createTemporaryDirectory } from '#tools/temp-directory.ts'
import { resendEmailSchema, sendResendEmail } from './resend.ts'

test('sendResendEmail posts to the mock Resend API', async () => {
	await using tempDir = await createTemporaryDirectory('resend-mock-')
	using server = createMockResendServer({
		storageDir: tempDir.path,
		port: 0,
	})
	const email = {
		to: 'alex@example.com',
		from: 'no-reply@example.com',
		subject: 'Reset your password',
		html: '<p>Reset link</p>',
	}
	const result = await sendResendEmail(
		{ apiBaseUrl: server.baseUrl, apiKey: 'test-key' },
		email,
	)
	expect(result.ok).toBe(true)

	const requests = await readMockRequests(tempDir.path)
	expect(requests.length).toBe(1)
	expect(requests[0]?.path).toBe('/emails')
	const recorded = resendEmailSchema.parse(requests[0]?.body)
	expect(recorded).toEqual(email)
})
