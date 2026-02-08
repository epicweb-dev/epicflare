import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

const mockApiRequestSchema = z.object({
	id: z.string(),
	receivedAt: z.string(),
	method: z.string(),
	path: z.string(),
	headers: z.record(z.string(), z.string()),
	body: z.unknown(),
})

export type MockApiRequestRecord = z.infer<typeof mockApiRequestSchema>

export type MockApiResponse = {
	status?: number
	headers?: Record<string, string>
	body?: unknown
}

export type MockApiRoute = {
	method: string
	path: string
	record?: boolean
	handler?: (context: {
		request: Request
		url: URL
		body: unknown
		record: MockApiRequestRecord
	}) => Promise<MockApiResponse> | MockApiResponse
	response?: MockApiResponse
}

export type MockApiServer = {
	url: string
	stop: () => void
}

export type MockApiServerOptions = {
	hostname?: string
	port?: number
	storageDir: string
	routes: Array<MockApiRoute>
}

function createRecord(request: Request, url: URL, body: unknown) {
	return {
		id: crypto.randomUUID(),
		receivedAt: new Date().toISOString(),
		method: request.method.toUpperCase(),
		path: url.pathname,
		headers: Object.fromEntries(request.headers),
		body,
	} satisfies MockApiRequestRecord
}

async function parseRequestBody(request: Request) {
	const contentType = request.headers.get('content-type') ?? ''
	if (contentType.includes('application/json')) {
		return request.json().catch(() => null)
	}
	if (contentType.includes('application/x-www-form-urlencoded')) {
		const text = await request.text()
		return Object.fromEntries(new URLSearchParams(text))
	}
	const text = await request.text()
	return text.length > 0 ? text : null
}

async function writeMockRequest(
	storageDir: string,
	record: MockApiRequestRecord,
) {
	await mkdir(storageDir, { recursive: true })
	const filename = `mock-request-${Date.now()}-${record.id}.json`
	const target = join(storageDir, filename)
	await writeFile(target, JSON.stringify(record, null, 2))
	return target
}

function resolveResponse(response?: MockApiResponse) {
	const status = response?.status ?? 200
	const headers = {
		'Content-Type': 'application/json',
		...response?.headers,
	}
	const body =
		typeof response?.body === 'string'
			? response.body
			: JSON.stringify(response?.body ?? {})
	return new Response(body, { status, headers })
}

export function createMockApiServer(
	options: MockApiServerOptions,
): MockApiServer {
	const hostname = options.hostname ?? '127.0.0.1'
	const server = Bun.serve({
		hostname,
		port: options.port ?? 0,
		fetch: async (request) => {
			const url = new URL(request.url)
			const route = options.routes.find(
				(entry) =>
					entry.method.toUpperCase() === request.method.toUpperCase() &&
					entry.path === url.pathname,
			)
			if (!route) {
				return new Response('Not Found', { status: 404 })
			}

			const body = await parseRequestBody(request)
			const record = createRecord(request, url, body)
			if (route.record !== false) {
				await writeMockRequest(options.storageDir, record)
			}

			if (route.handler) {
				const response = await route.handler({
					request,
					url,
					body,
					record,
				})
				return resolveResponse(response)
			}

			return resolveResponse(route.response)
		},
	})

	return {
		url: `http://${hostname}:${server.port}`,
		stop: () => server.stop(),
	}
}

export async function readMockRequests(storageDir: string) {
	try {
		const entries = await readdir(storageDir)
		const records = await Promise.all(
			entries
				.filter((entry) => entry.endsWith('.json'))
				.map(async (entry) => {
					const content = await readFile(join(storageDir, entry), 'utf-8')
					const parsed = JSON.parse(content) as unknown
					return mockApiRequestSchema.parse(parsed)
				}),
		)
		return records.sort((left, right) =>
			left.receivedAt.localeCompare(right.receivedAt),
		)
	} catch (error) {
		const errorCode = (error as NodeJS.ErrnoException | undefined)?.code
		if (errorCode === 'ENOENT') {
			return []
		}
		throw error
	}
}

export { mockApiRequestSchema }
