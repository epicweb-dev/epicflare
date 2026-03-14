/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { createAiRuntime } from './ai-runtime.ts'

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
