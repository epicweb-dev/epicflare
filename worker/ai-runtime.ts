import {
	convertToModelMessages,
	streamText,
	type StreamTextOnFinishCallback,
	type ToolSet,
	type UIMessage,
} from 'ai'
import { createWorkersAI } from 'workers-ai-provider'
import { type AiMode } from '#shared/chat.ts'
import { type MockAiResponse } from '#shared/mock-ai.ts'

const defaultModel = '@cf/zai-org/glm-4.7-flash'

export type StreamChatReplyInput = {
	messages: Array<UIMessage>
	system: string
	tools: ToolSet
	toolNames: Array<string>
	abortSignal?: AbortSignal
	onFinish?: StreamTextOnFinishCallback<ToolSet>
}

export type AiRuntimeResult =
	| { kind: 'response'; response: Response }
	| MockAiResponse

export type AiRuntime = {
	streamChatReply(input: StreamChatReplyInput): Promise<AiRuntimeResult>
}

type AIEnabledEnv = Env & {
	AI: Ai
}

type WorkersAiCredentialsEnv = Env & {
	CLOUDFLARE_ACCOUNT_ID?: string
	CLOUDFLARE_API_TOKEN?: string
	WRANGLER_IS_LOCAL_DEV?: string
}

function resolveAiMode(env: Env): AiMode {
	if (env.AI_MODE) return env.AI_MODE
	return 'mock'
}

function createWorkersAiProvider(env: WorkersAiCredentialsEnv) {
	const gateway = env.AI_GATEWAY_ID ? { gateway: { id: env.AI_GATEWAY_ID } } : {}
	const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim()
	const apiKey = env.CLOUDFLARE_API_TOKEN?.trim()
	const shouldUseCredentials =
		env.WRANGLER_IS_LOCAL_DEV === 'true' && accountId && apiKey

	if (shouldUseCredentials) {
		return createWorkersAI({
			accountId,
			apiKey,
			...gateway,
		})
	}

	return createWorkersAI({
		binding: (env as AIEnabledEnv).AI,
		...gateway,
	})
}

function createRemoteAiRuntime(env: WorkersAiCredentialsEnv): AiRuntime {
	return {
		async streamChatReply(input) {
			const workersai = createWorkersAiProvider(env)

			const result = streamText({
				model: workersai(env.AI_MODEL ?? defaultModel),
				system: input.system,
				messages: await convertToModelMessages(input.messages),
				tools: input.tools,
				abortSignal: input.abortSignal,
				onFinish: input.onFinish,
			})

			return {
				kind: 'response',
				response: result.toUIMessageStreamResponse(),
			}
		},
	}
}

function createMockAiRuntime(env: Env): AiRuntime {
	const baseUrl = env.AI_MOCK_BASE_URL?.trim()
	if (!baseUrl) {
		throw new Error(
			'AI_MOCK_BASE_URL is required when AI_MODE is "mock". Start the mock AI worker or set AI_MODE=remote.',
		)
	}

	return {
		async streamChatReply(input) {
			const url = new URL('/chat', baseUrl)
			const response = await fetch(url.toString(), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(env.AI_MOCK_API_KEY
						? {
								Authorization: `Bearer ${env.AI_MOCK_API_KEY}`,
							}
						: {}),
				},
				body: JSON.stringify({
					system: input.system,
					messages: input.messages,
					toolNames: input.toolNames,
				}),
				signal: input.abortSignal,
			})

			if (!response.ok) {
				const body = await response.text().catch(() => '')
				throw new Error(
					`Mock AI worker failed (${response.status} ${response.statusText}): ${body}`,
				)
			}

			return (await response.json()) as MockAiResponse
		},
	}
}

export function createAiRuntime(env: Env): AiRuntime {
	const mode = resolveAiMode(env)
	if (mode === 'remote') return createRemoteAiRuntime(env as AIEnabledEnv)
	return createMockAiRuntime(env)
}
