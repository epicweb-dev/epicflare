import {
	MessageType,
	type OutgoingMessage,
	type IncomingMessage,
} from '@cloudflare/ai-chat/types'
import { type UIMessage } from 'ai'
import { AgentClient } from 'agents/client'
import { chatAgentBasePath } from '#shared/chat-routes.ts'

export type ChatClientSnapshot = {
	messages: Array<UIMessage>
	streamingText: string
	isStreaming: boolean
	error: string | null
	connected: boolean
}

type ChatClientOptions = {
	threadId: string
	onSnapshot: (snapshot: ChatClientSnapshot) => void
}

function createUserMessage(text: string): UIMessage {
	return {
		id: `user_${crypto.randomUUID()}`,
		role: 'user',
		parts: [{ type: 'text', text }],
	}
}

function buildChatAgentFetchUrl(threadId: string, suffix = '') {
	return new URL(
		`${chatAgentBasePath}/${threadId}${suffix}`,
		window.location.href,
	)
}

export class ChatClient {
	private threadId: string
	private socket: AgentClient | null = null
	private activeRequestId: string | null = null
	private connectionWaiters = new Set<{
		resolve: () => void
		reject: (error: Error) => void
		timeoutId: number
	}>()
	private snapshot: ChatClientSnapshot = {
		messages: [],
		streamingText: '',
		isStreaming: false,
		error: null,
		connected: false,
	}
	private onSnapshot: (snapshot: ChatClientSnapshot) => void

	constructor(options: ChatClientOptions) {
		this.threadId = options.threadId
		this.onSnapshot = options.onSnapshot
	}

	private emitSnapshot() {
		this.onSnapshot({ ...this.snapshot, messages: [...this.snapshot.messages] })
	}

	private updateSnapshot(next: Partial<ChatClientSnapshot>) {
		this.snapshot = {
			...this.snapshot,
			...next,
		}
		this.emitSnapshot()
	}

	private resolveConnectionWaiters() {
		for (const waiter of this.connectionWaiters) {
			window.clearTimeout(waiter.timeoutId)
			waiter.resolve()
		}
		this.connectionWaiters.clear()
	}

	private rejectConnectionWaiters(message: string) {
		for (const waiter of this.connectionWaiters) {
			window.clearTimeout(waiter.timeoutId)
			waiter.reject(new Error(message))
		}
		this.connectionWaiters.clear()
	}

	private async reloadMessages() {
		const response = await fetch(
			buildChatAgentFetchUrl(this.threadId, '/get-messages').toString(),
			{
				credentials: 'include',
				headers: { Accept: 'application/json' },
			},
		)
		if (!response.ok) {
			throw new Error(
				`Failed to reload chat messages (${response.status} ${response.statusText}).`,
			)
		}
		const messages = (await response.json()) as Array<UIMessage>
		this.updateSnapshot({ messages })
	}

	async initialize() {
		await this.reloadMessages()
		this.connect()
	}

	async waitUntilConnected(timeoutMs = 5_000) {
		if (this.snapshot.connected && this.socket?.readyState === WebSocket.OPEN)
			return

		await new Promise<void>((resolve, reject) => {
			const timeoutId = window.setTimeout(() => {
				this.connectionWaiters.delete(waiter)
				reject(new Error('Chat connection timed out. Please try again.'))
			}, timeoutMs)
			const waiter = {
				resolve,
				reject,
				timeoutId,
			}
			this.connectionWaiters.add(waiter)
		})
	}

	private connect() {
		if (this.socket) this.socket.close()
		const socket = new AgentClient({
			agent: 'chat-agent',
			name: this.threadId,
			host: window.location.host,
			protocol: window.location.protocol === 'https:' ? 'wss' : 'ws',
		})
		this.socket = socket

		socket.addEventListener('open', () => {
			this.updateSnapshot({ connected: true, error: null })
			this.resolveConnectionWaiters()
			socket.send(
				JSON.stringify({ type: MessageType.CF_AGENT_STREAM_RESUME_REQUEST }),
			)
		})

		socket.addEventListener('close', () => {
			const wasConnected = this.snapshot.connected
			if (this.socket === socket) this.socket = null
			this.updateSnapshot({ connected: false })
			if (!wasConnected) {
				this.rejectConnectionWaiters(
					'Chat connection closed before it was ready.',
				)
			}
		})

		socket.addEventListener('error', () => {
			this.updateSnapshot({
				error: 'Chat connection failed. Please refresh and try again.',
			})
			this.rejectConnectionWaiters(
				'Chat connection failed. Please refresh and try again.',
			)
		})

		socket.addEventListener('message', (event) => {
			let data: unknown = null
			try {
				data = JSON.parse(String(event.data))
			} catch {
				return
			}
			if (!data || typeof data !== 'object' || !('type' in data)) return

			const message = data as OutgoingMessage
			switch (message.type) {
				case MessageType.CF_AGENT_CHAT_MESSAGES: {
					this.updateSnapshot({
						messages: message.messages,
						error: null,
					})
					return
				}
				case MessageType.CF_AGENT_CHAT_CLEAR: {
					this.activeRequestId = null
					this.updateSnapshot({
						messages: [],
						streamingText: '',
						isStreaming: false,
						error: null,
					})
					return
				}
				case MessageType.CF_AGENT_STREAM_RESUMING: {
					socket.send(
						JSON.stringify({
							type: MessageType.CF_AGENT_STREAM_RESUME_ACK,
							id: message.id,
						} satisfies IncomingMessage),
					)
					return
				}
				case MessageType.CF_AGENT_STREAM_RESUME_NONE: {
					return
				}
				case MessageType.CF_AGENT_USE_CHAT_RESPONSE: {
					if (message.id !== this.activeRequestId) return
					if (message.error) {
						this.activeRequestId = null
						this.updateSnapshot({
							error: message.body || 'Chat generation failed.',
							isStreaming: false,
							streamingText: '',
						})
						return
					}

					if (message.body?.trim()) {
						try {
							const chunk = JSON.parse(message.body) as {
								type?: string
								delta?: string
								value?: string
							}
							if (chunk.type === 'text-start') {
								this.updateSnapshot({ streamingText: '', isStreaming: true })
							} else if (chunk.type === 'text-delta' && chunk.delta) {
								this.updateSnapshot({
									isStreaming: true,
									streamingText: `${this.snapshot.streamingText}${chunk.delta}`,
								})
							} else if (chunk.type === 'text' && chunk.value) {
								this.updateSnapshot({
									isStreaming: true,
									streamingText: `${this.snapshot.streamingText}${chunk.value}`,
								})
							}
						} catch {
							// Ignore non-text chunks; the persisted message snapshot will catch up.
						}
					}

					if (message.done) {
						this.activeRequestId = null
						this.updateSnapshot({
							isStreaming: false,
							streamingText: '',
						})
						void this.reloadMessages().catch((error: unknown) => {
							this.updateSnapshot({
								error:
									error instanceof Error
										? error.message
										: 'Unable to refresh chat messages.',
							})
						})
					}
					return
				}
			}
		})
	}

	sendMessage(text: string) {
		const trimmed = text.trim()
		if (!trimmed) return
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			throw new Error('Chat connection is not ready.')
		}

		const nextMessages = [...this.snapshot.messages, createUserMessage(trimmed)]
		const requestId = crypto.randomUUID()
		this.activeRequestId = requestId
		this.updateSnapshot({
			messages: nextMessages,
			streamingText: '',
			isStreaming: true,
			error: null,
		})

		this.socket.send(
			JSON.stringify({
				type: MessageType.CF_AGENT_USE_CHAT_REQUEST,
				id: requestId,
				init: {
					method: 'POST',
					body: JSON.stringify({
						messages: nextMessages,
						trigger: 'submit-message',
					}),
				},
			} satisfies IncomingMessage),
		)
	}

	async clearHistory() {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
			throw new Error('Chat connection is not ready.')
		}
		this.socket.send(JSON.stringify({ type: MessageType.CF_AGENT_CHAT_CLEAR }))
	}

	close() {
		this.rejectConnectionWaiters('Chat connection closed.')
		this.socket?.close()
		this.socket = null
	}
}
