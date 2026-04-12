/// <reference types="bun" />
import { createServer } from 'node:http'
import { type AddressInfo } from 'node:net'
import { expect, test, vi } from 'vitest'

async function loadCreateAiRuntime(
	setupMocks?: () => void,
) {
	vi.resetModules()
	setupMocks?.()
	const module = await import('./ai-runtime.ts')
	return module.createAiRuntime
}

async function createMockServer() {
	const server = createServer((request, response) => {
		const url = new URL(request.url ?? '', 'http://127.0.0.1')
		if (url.pathname !== '/chat') {
			response.statusCode = 404
			response.end('Not Found')
			return
		}

		response.statusCode = 200
		response.setHeader('Content-Type', 'application/json')
		response.end(
			JSON.stringify({
				kind: 'text',
				text: 'hello from mock runtime',
				chunks: ['hello ', 'from ', 'mock runtime'],
			}),
		)
	})

	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', resolve)
	})
	const address = server.address() as AddressInfo

	return {
		baseUrl: `http://127.0.0.1:${address.port}`,
		[Symbol.asyncDispose]: async () => {
			await new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) {
						reject(error)
						return
					}
					resolve()
				})
			})
		},
	}
}

test('createAiRuntime uses mock backend when AI_MODE=mock', async () => {
	await using mockServer = await createMockServer()
	const createAiRuntime = await loadCreateAiRuntime()
	const runtime = createAiRuntime({
		AI_MODE: 'mock',
		AI_MOCK_BASE_URL: mockServer.baseUrl,
		AI_MOCK_API_KEY: 'token',
	} as Env)

	const result = await runtime.streamChatReply({
		messages: [],
		system: 'test',
		tools: {},
		toolNames: ['do_math'],
	})

	expect(result).toEqual({
		kind: 'text',
		text: 'hello from mock runtime',
		chunks: ['hello ', 'from ', 'mock runtime'],
	})
})

test('createAiRuntime defaults to mock mode when AI_MODE is missing', async () => {
	await using mockServer = await createMockServer()
	const createAiRuntime = await loadCreateAiRuntime()
	const runtime = createAiRuntime({
		AI_MOCK_BASE_URL: mockServer.baseUrl,
		AI_MOCK_API_KEY: 'token',
	} as Env)

	const result = await runtime.streamChatReply({
		messages: [],
		system: 'test',
		tools: {},
		toolNames: [],
	})

	expect(result.kind).toBe('text')
})

test('createAiRuntime throws a helpful error for missing local remote AI credentials', async () => {
	const createAiRuntime = await loadCreateAiRuntime()
	const runtime = createAiRuntime({
		AI_MODE: 'remote',
		AI_GATEWAY_ID: 'gateway-id',
		WRANGLER_IS_LOCAL_DEV: 'true',
	} as Env)

	await expect(
		runtime.streamChatReply({
			messages: [],
			system: 'test',
			tools: {},
			toolNames: [],
		}),
	).rejects.toThrow(
		'CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required when AI_MODE is "remote" in local dev. Add them to .env before starting `bun run dev`.',
	)
})

test('createAiRuntime configures remote streaming to continue after tool calls', async () => {
	const streamTextCalls: Array<Record<string, unknown>> = []
	const stopWhenCalls: Array<number> = []

	const createAiRuntime = await loadCreateAiRuntime(() => {
		vi.doMock('ai', () => ({
			convertToModelMessages: async (messages: Array<unknown>) => messages,
			stepCountIs: (stepCount: number) => {
				stopWhenCalls.push(stepCount)
				return { kind: 'stop-condition', stepCount }
			},
			streamText: (options: Record<string, unknown>) => {
				streamTextCalls.push(options)
				return {
					toUIMessageStreamResponse: () =>
						new Response('ok', {
							headers: { 'Content-Type': 'text/plain; charset=utf-8' },
						}),
				}
			},
		}))
		vi.doMock('workers-ai-provider', () => ({
			createWorkersAI: () => (model: string) => ({ provider: 'workers-ai', model }),
		}))
	})
	const runtime = createAiRuntime({
		AI_MODE: 'remote',
		AI_GATEWAY_ID: 'gateway-id',
		AI: {} as Ai,
	} as Env)

	const onFinish = () => Promise.resolve()
	const response = await runtime.streamChatReply({
		messages: [],
		system: 'test',
		tools: {},
		toolNames: ['do_math'],
		onFinish,
	})

	expect(response.kind).toBe('response')
	expect(stopWhenCalls).toEqual([5])
	expect(streamTextCalls).toHaveLength(1)
	expect(streamTextCalls[0]).toMatchObject({
		system: 'test',
		tools: {},
		onFinish,
		stopWhen: { kind: 'stop-condition', stepCount: 5 },
	})

	vi.doUnmock('ai')
	vi.doUnmock('workers-ai-provider')
})
