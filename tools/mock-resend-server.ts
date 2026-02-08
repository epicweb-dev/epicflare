import { resendEmailSchema } from '../shared/resend-email.ts'
import { createMockApiServer } from './mock-api-server.ts'

const storageDir = process.env.MOCK_API_STORAGE_DIR ?? 'mock-data/resend'
const port = Number(process.env.MOCK_API_PORT ?? 8788)

const server = createMockApiServer({
	port: Number.isFinite(port) ? port : 8788,
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

console.info(`Mock Resend API running at ${server.url}`)
console.info(`Saving mock requests to ${storageDir}`)
