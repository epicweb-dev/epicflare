/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
	createMockApiServer,
	readMockRequests,
} from '../../tools/mock-api-server.ts'
import { resendEmailSchema, sendResendEmail } from './resend.ts'

test('sendResendEmail posts to the mock Resend API', async () => {
	const storageDir = await mkdtemp(join(tmpdir(), 'resend-mock-'))
	const server = createMockApiServer({
		storageDir,
		port: 0,
		routes: [
			{
				method: 'POST',
				path: '/emails',
				handler: ({ body }) => {
					const parsed = resendEmailSchema.safeParse(body)
					if (!parsed.success) {
						return { status: 400, body: { error: 'Invalid payload.' } }
					}
					return { status: 200, body: { id: 'email_test' } }
				},
			},
		],
	})

	try {
		const email = {
			to: 'alex@example.com',
			from: 'no-reply@example.com',
			subject: 'Reset your password',
			html: '<p>Reset link</p>',
		}
		const result = await sendResendEmail(
			{ apiBaseUrl: server.url, apiKey: 'test-key' },
			email,
		)
		expect(result.ok).toBe(true)

		const requests = await readMockRequests(storageDir)
		expect(requests.length).toBe(1)
		const recorded = resendEmailSchema.parse(requests[0]?.body)
		expect(recorded).toEqual(email)
	} finally {
		server.stop()
		await rm(storageDir, { recursive: true, force: true })
	}
})
