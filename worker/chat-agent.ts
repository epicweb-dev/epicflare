import { AIChatAgent } from '@cloudflare/ai-chat'
import {
	type StreamTextOnFinishCallback,
	type ToolSet,
	type UIMessage,
} from 'ai'
import { type Connection, type ConnectionContext } from 'agents'
import { createMcpCallerContext } from '#mcp/context.ts'
import { readAuthenticatedAppUser } from '#server/authenticated-user.ts'
import { createChatThreadsStore } from '#server/chat-threads.ts'
import { createAiRuntime, type AiRuntimeResult } from './ai-runtime.ts'

function buildSystemPrompt() {
	return [
		'You are a helpful assistant inside epicflare.',
		'Use MCP tools when they provide a more reliable or interactive result than freeform text.',
		'When a tool is useful, call it instead of guessing.',
	].join(' ')
}

function getTextParts(message: UIMessage) {
	return message.parts
		.filter(
			(
				part,
			): part is Extract<(typeof message.parts)[number], { type: 'text' }> =>
				part.type === 'text',
		)
		.map((part) => part.text)
}

function getLatestUserMessageText(messages: Array<UIMessage>) {
	const userMessages = messages.filter((message) => message.role === 'user')
	const latestMessage = userMessages.at(-1)
	if (!latestMessage) return ''
	return getTextParts(latestMessage).join('\n').trim()
}

function buildThreadTitle(messages: Array<UIMessage>) {
	const firstUserMessage = messages.find((message) => message.role === 'user')
	if (!firstUserMessage) return ''
	const text = getTextParts(firstUserMessage).join('\n').trim()
	if (!text) return ''
	return text.slice(0, 120)
}

function buildLastPreview(input: { userText: string; assistantText?: string }) {
	const assistantPreview = input.assistantText?.trim() ?? ''
	if (assistantPreview) return assistantPreview.slice(0, 160)
	return input.userText.trim().slice(0, 160)
}

function createTextResponse(text: string, chunks?: Array<string>) {
	const body = chunks && chunks.length > 0 ? chunks.join('') : text
	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}

function createErrorResponse(message: string) {
	return new Response(message, {
		status: 500,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	})
}

export class ChatAgent extends AIChatAgent<Env> {
	waitForMcpConnections = true
	private runtimeContext: {
		appUserId: number
		baseUrl: string
		user: ReturnType<typeof createMcpCallerContext>['user']
	} | null = null

	private getRuntimeContext() {
		if (!this.runtimeContext) {
			this.restoreRuntimeContext()
		}
		if (!this.runtimeContext) {
			throw new Error(
				'Chat agent runtime context has not been initialized yet.',
			)
		}
		return this.runtimeContext
	}

	private ensureRuntimeContextTable() {
		void this.sql`
			CREATE TABLE IF NOT EXISTS chat_agent_runtime_context (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			)
		`
	}

	private restoreRuntimeContext() {
		this.ensureRuntimeContextTable()
		const rows =
			this.sql<{ value: string }>`
				SELECT value FROM chat_agent_runtime_context
				WHERE key = 'runtimeContext'
			` || []
		const row = rows[0]
		if (!row) return
		try {
			this.runtimeContext = JSON.parse(row.value) as NonNullable<
				typeof this.runtimeContext
			>
		} catch {
			this.runtimeContext = null
		}
	}

	private persistRuntimeContext() {
		if (!this.runtimeContext) return
		this.ensureRuntimeContextTable()
		void this.sql`
			INSERT OR REPLACE INTO chat_agent_runtime_context (key, value)
			VALUES ('runtimeContext', ${JSON.stringify(this.runtimeContext)})
		`
	}

	private getThreadStore() {
		return createChatThreadsStore(this.env.APP_DB)
	}

	private async syncThreadMetadata(input: {
		assistantText?: string
		messageCountOffset?: number
	}) {
		const { appUserId } = this.getRuntimeContext()
		const threadId = this.name
		const title = buildThreadTitle(this.messages)
		const userText = getLatestUserMessageText(this.messages)
		const messageCount = this.messages.length + (input.messageCountOffset ?? 0)
		return this.getThreadStore().syncMetadataForUser({
			userId: appUserId,
			threadId,
			title,
			lastMessagePreview: buildLastPreview({
				userText,
				assistantText: input.assistantText,
			}),
			messageCount,
		})
	}

	private async initializeRuntimeContextFromRequest(request: Request) {
		const user = await readAuthenticatedAppUser(request, this.env)
		if (!user) {
			throw new Error('Unauthorized chat agent connection.')
		}
		const baseUrl = new URL(request.url).origin
		this.runtimeContext = {
			appUserId: user.userId,
			baseUrl,
			user: user.mcpUser,
		}
		this.persistRuntimeContext()
		await this.addMcpServer('epicflare', this.env.MCP_OBJECT, {
			props: createMcpCallerContext({
				baseUrl,
				user: user.mcpUser,
			}),
		})
	}

	async onConnect(
		connection: Connection,
		ctx: ConnectionContext,
	): Promise<void> {
		await this.initializeRuntimeContextFromRequest(ctx.request)
		void connection
	}

	async onRequest(request: Request): Promise<Response> {
		await this.initializeRuntimeContextFromRequest(request)
		return new Response('Not implemented', { status: 404 })
	}

	private async createMockToolCallResponse(
		result: Extract<AiRuntimeResult, { kind: 'tool-call' }>,
	) {
		const tool = this.mcp
			.listTools()
			.find((entry) => entry.name === result.toolName)
		if (!tool) {
			return createErrorResponse(
				`Mock tool "${result.toolName}" is not available.`,
			)
		}

		const toolResult = await this.mcp.callTool({
			serverId: tool.serverId,
			name: result.toolName,
			arguments: result.input,
		})
		const output =
			'structuredContent' in toolResult && toolResult.structuredContent
				? toolResult.structuredContent
				: toolResult.content
		const toolContents = Array.isArray(toolResult.content)
			? (toolResult.content as Array<{ type: string; text?: string }>)
			: []

		const assistantText =
			result.text?.trim() ||
			toolContents
				.filter((part) => part.type === 'text')
				.map((part) => part.text)
				.join('\n')
				.trim()

		await this.syncThreadMetadata({
			assistantText,
			messageCountOffset: 1,
		})

		const fallbackText =
			assistantText ||
			(typeof output === 'string' ? output : JSON.stringify(output, null, 2))
		return createTextResponse(fallbackText)
	}

	async onChatMessage(
		onFinish: StreamTextOnFinishCallback<ToolSet>,
		options?: { abortSignal?: AbortSignal },
	): Promise<Response | undefined> {
		const aiRuntime = createAiRuntime(this.env)
		const tools = this.mcp.getAITools()
		const toolNames = this.mcp.listTools().map((tool) => tool.name)
		const wrappedOnFinish: StreamTextOnFinishCallback<ToolSet> = async (
			event,
		) => {
			await onFinish(event)
			await this.syncThreadMetadata({
				assistantText: event.text,
				messageCountOffset: 1,
			})
		}

		await this.syncThreadMetadata({})

		const runtimeResult = await aiRuntime.streamChatReply({
			messages: this.messages,
			system: buildSystemPrompt(),
			tools,
			toolNames,
			abortSignal: options?.abortSignal,
			onFinish: wrappedOnFinish,
		})

		if (runtimeResult.kind === 'response') {
			return runtimeResult.response
		}

		if (runtimeResult.kind === 'error') {
			return createErrorResponse(runtimeResult.message)
		}

		if (runtimeResult.kind === 'tool-call') {
			return this.createMockToolCallResponse(runtimeResult)
		}

		await this.syncThreadMetadata({
			assistantText: runtimeResult.text,
			messageCountOffset: 1,
		})
		return createTextResponse(runtimeResult.text, runtimeResult.chunks)
	}

	async clearThread() {
		await this.getThreadStore().syncMetadataForUser({
			userId: this.getRuntimeContext().appUserId,
			threadId: this.name,
			lastMessagePreview: null,
			messageCount: 0,
			title: 'New chat',
		})
	}
}
