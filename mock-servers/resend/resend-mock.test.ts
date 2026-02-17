/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { unstable_dev } from 'wrangler'
import { createTemporaryDirectory } from '#tools/temp-directory.ts'

const workerScript = 'mock-servers/resend/worker.ts'
const workerConfig = 'mock-servers/resend/wrangler.jsonc'

test('resend mock stores messages in D1 and exposes a count', async () => {
	await using tempDir = await createTemporaryDirectory('resend-mock-d1-')
	const token = 'test-mock-token'
	const worker = await unstable_dev(workerScript, {
		config: workerConfig,
		env: 'test',
		local: true,
		persistTo: tempDir.path,
		vars: {
			MOCK_API_TOKEN: token,
		},
		experimental: { disableExperimentalWarning: true, testMode: true },
	})

	try {
		const email = {
			to: 'alex@example.com',
			from: 'no-reply@example.com',
			subject: 'Reset your password',
			html: '<p>Reset link</p>',
		}

		const createResp = await worker.fetch('http://example.com/emails', {
			method: 'POST',
			headers: {
				authorization: `Bearer ${token}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(email),
		})
		expect(createResp.status).toBe(200)
		const createJson = (await createResp.json()) as { id?: string }
		expect(typeof createJson.id).toBe('string')

		const metaResp = await worker.fetch('http://example.com/__mocks/meta', {
			headers: { authorization: `Bearer ${token}` },
		})
		expect(metaResp.status).toBe(200)
		const metaJson = (await metaResp.json()) as {
			authorized: boolean
			messageCount?: number
		}
		expect(metaJson.authorized).toBe(true)
		expect(metaJson.messageCount).toBe(1)

		const listResp = await worker.fetch(
			'http://example.com/__mocks/messages?limit=10',
			{
				headers: { authorization: `Bearer ${token}` },
			},
		)
		expect(listResp.status).toBe(200)
		const listJson = (await listResp.json()) as {
			count: number
			messages: Array<{
				id: string
				received_at: number
				from_email: string
				to_json: string
				subject: string
			}>
		}
		expect(listJson.count).toBe(1)
		expect(listJson.messages[0]?.subject).toBe(email.subject)
		expect(listJson.messages[0]?.from_email).toBe(email.from)
		expect(JSON.parse(listJson.messages[0]?.to_json ?? 'null')).toEqual(
			email.to,
		)
	} finally {
		await worker.stop()
	}
})

test('resend mock rejects unauthenticated requests when a token is configured', async () => {
	await using tempDir = await createTemporaryDirectory('resend-mock-auth-')
	const token = 'test-mock-token'
	const worker = await unstable_dev(workerScript, {
		config: workerConfig,
		env: 'test',
		local: true,
		persistTo: tempDir.path,
		vars: {
			MOCK_API_TOKEN: token,
		},
		experimental: { disableExperimentalWarning: true, testMode: true },
	})

	try {
		const createResp = await worker.fetch('http://example.com/emails', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				to: 'alex@example.com',
				from: 'no-reply@example.com',
				subject: 'hello',
				html: '<p>hi</p>',
			}),
		})
		expect(createResp.status).toBe(401)
	} finally {
		await worker.stop()
	}
})
