/// <reference types="bun" />
import { expect, mock, test } from 'bun:test'

async function loadCreateAiRuntime(cacheKey = crypto.randomUUID()) {
	const module = await import(`./ai-runtime.ts?test=${cacheKey}`)
	return module.createAiRuntime
}

async function createMockServer() {
	const server = Bun.serve({
		port: 0,
		fetch(request) {
			const url = new URL(request.url)
			if (url.pathname !== '/chat') {
				return new Response('Not Found', { status: 404 })
			}
			return Response.json({
				kind: 'text',
				text: 'hello from mock runtime',
				chunks: ['hello ', 'from ', 'mock runtime'],
			})
		},
	})

	return {
		baseUrl: `http://127.0.0.1:${server.port}`,
		[Symbol.asyncDispose]: async () => {
			await server.stop()
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

	mock.module('ai', () => ({
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
	mock.module('workers-ai-provider', () => ({
		createWorkersAI: () => (model: string) => ({ provider: 'workers-ai', model }),
	}))

	const createAiRuntime = await loadCreateAiRuntime('remote-tool-loop')
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
})
