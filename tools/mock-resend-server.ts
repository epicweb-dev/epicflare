import { resendEmailSchema } from '#shared/resend-email.ts'
import { createMockApiServer, type MockApiServer } from './mock-api-server.ts'

export type MockResendServer = MockApiServer & {
	baseUrl: string
	storageDir: string
}

export function createMockResendServer(
	options: {
		port?: number
		storageDir?: string
	} = {},
): MockResendServer {
	const storageDir = options.storageDir ?? 'mock-data/resend'
	const server = createMockApiServer({
		port: options.port,
		storageDir,
		routes: [
			{
				method: 'POST',
				path: '/emails',
				handler: ({ body }) => {
					const parsed = resendEmailSchema.safeParse(body)
					if (!parsed.success) {
						return {
							status: 400,
							body: { error: 'Invalid email payload.' },
						}
					}
					return {
						status: 200,
						body: { id: `email_${crypto.randomUUID()}` },
					}
				},
			},
		],
	})
	const baseUrl = server.url

	return { ...server, baseUrl, storageDir }
}

if (import.meta.main) {
	const port = Number(process.env.MOCK_API_PORT ?? 8788)
	const storageDir = process.env.MOCK_API_STORAGE_DIR ?? 'mock-data/resend'
	const server = createMockResendServer({
		port: Number.isFinite(port) ? port : 8788,
		storageDir,
	})
	console.info(`Mock Resend API running at ${server.url}`)
	console.info(`Mock Resend base URL ${server.baseUrl}`)
	console.info(`Saving mock requests to ${server.storageDir}`)
}
