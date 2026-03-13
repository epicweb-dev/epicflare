import { type Handle } from 'remix/component'
import { ChatClient, type ChatClientSnapshot } from '#client/chat-client.ts'
import { navigate, routerEvents } from '#client/client-router.tsx'
import {
	colors,
	radius,
	shadows,
	spacing,
	transitions,
	typography,
} from '#client/styles/tokens.ts'
import { type ChatThreadSummary } from '#shared/chat.ts'

type ThreadStatus = 'idle' | 'loading' | 'ready' | 'error'

function getSelectedThreadIdFromLocation() {
	if (typeof window === 'undefined') return null
	const prefix = '/chat/'
	if (!window.location.pathname.startsWith(prefix)) return null
	const threadId = window.location.pathname.slice(prefix.length).trim()
	return threadId || null
}

function buildThreadHref(threadId: string) {
	return `/chat/${threadId}`
}

function createInitialSnapshot(): ChatClientSnapshot {
	return {
		messages: [],
		streamingText: '',
		isStreaming: false,
		error: null,
		connected: false,
	}
}

function buildThreadPreviewFromMessages(
	messages: ChatClientSnapshot['messages'],
) {
	const lastMessage = messages.at(-1)
	if (!lastMessage) return null
	const text = lastMessage.parts
		.filter(
			(
				part,
			): part is Extract<
				(typeof lastMessage.parts)[number],
				{ type: 'text'; text: string }
			> => part.type === 'text' && typeof part.text === 'string',
		)
		.map((part) => part.text)
		.join('\n')
		.trim()
	return text ? text.slice(0, 160) : null
}

async function fetchThreads(signal?: AbortSignal) {
	const response = await fetch('/chat-threads', {
		credentials: 'include',
		headers: { Accept: 'application/json' },
		signal,
	})
	const payload = (await response.json().catch(() => null)) as {
		ok?: boolean
		threads?: Array<ChatThreadSummary>
		error?: string
	} | null
	if (!response.ok || !payload?.ok || !Array.isArray(payload.threads)) {
		throw new Error(payload?.error || 'Unable to load threads.')
	}
	return payload.threads
}

async function createThread() {
	const response = await fetch('/chat-threads', {
		method: 'POST',
		credentials: 'include',
	})
	const payload = (await response.json().catch(() => null)) as {
		ok?: boolean
		thread?: ChatThreadSummary
		error?: string
	} | null
	if (!response.ok || !payload?.ok || !payload.thread) {
		throw new Error(payload?.error || 'Unable to create thread.')
	}
	return payload.thread
}

async function deleteThread(threadId: string) {
	const response = await fetch('/chat-threads/delete', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ threadId }),
	})
	const payload = (await response.json().catch(() => null)) as {
		ok?: boolean
		error?: string
	} | null
	if (!response.ok || !payload?.ok) {
		throw new Error(payload?.error || 'Unable to delete thread.')
	}
}

function renderMessageParts(
	parts: Array<{
		type: string
		text?: string
		state?: string
		input?: unknown
		output?: unknown
		errorText?: string
	}>,
) {
	return parts.map((part, index) => {
		if (part.type === 'text') {
			return (
				<p
					key={`${part.type}-${index}`}
					css={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
				>
					{part.text}
				</p>
			)
		}

		if (part.type.startsWith('tool-')) {
			return (
				<div
					key={`${part.type}-${index}`}
					css={{
						display: 'grid',
						gap: spacing.xs,
						padding: spacing.sm,
						borderRadius: radius.md,
						border: `1px solid ${colors.border}`,
						backgroundColor: colors.surface,
						fontSize: typography.fontSize.sm,
					}}
				>
					<strong>{part.type.replace(/^tool-/, '')}</strong>
					<span css={{ color: colors.textMuted }}>State: {part.state}</span>
					{part.input !== undefined ? (
						<code css={{ whiteSpace: 'pre-wrap' }}>
							Input: {JSON.stringify(part.input)}
						</code>
					) : null}
					{part.output !== undefined ? (
						<code css={{ whiteSpace: 'pre-wrap' }}>
							Output: {JSON.stringify(part.output)}
						</code>
					) : null}
					{part.errorText ? (
						<span css={{ color: colors.error }}>{part.errorText}</span>
					) : null}
				</div>
			)
		}

		return null
	})
}

export function ChatRoute(handle: Handle) {
	let threads: Array<ChatThreadSummary> = []
	let threadStatus: ThreadStatus = 'idle'
	let threadError: string | null = null
	let activeThreadId: string | null = null
	let chatSnapshot = createInitialSnapshot()
	let activeClient: ChatClient | null = null
	let actionError: string | null = null
	let syncInFlight = false

	function update() {
		handle.update()
	}

	function setThreadState(
		nextStatus: ThreadStatus,
		nextError: string | null = null,
	) {
		threadStatus = nextStatus
		threadError = nextError
		update()
	}

	function resetChatSnapshot() {
		chatSnapshot = createInitialSnapshot()
	}

	function updateLocalThreadSummary(
		threadId: string,
		snapshot: ChatClientSnapshot,
	) {
		threads = threads.map((thread) =>
			thread.id === threadId
				? {
						...thread,
						messageCount: snapshot.messages.length,
						lastMessagePreview: buildThreadPreviewFromMessages(
							snapshot.messages,
						),
					}
				: thread,
		)
	}

	async function connectThread(threadId: string) {
		if (activeThreadId === threadId && activeClient) return

		activeClient?.close()
		activeClient = new ChatClient({
			threadId,
			onSnapshot(snapshot) {
				if (activeThreadId !== threadId) return
				chatSnapshot = snapshot
				updateLocalThreadSummary(threadId, snapshot)
				update()
			},
		})
		activeThreadId = threadId
		resetChatSnapshot()
		update()

		try {
			await activeClient.initialize()
		} catch (error) {
			chatSnapshot = {
				...createInitialSnapshot(),
				error:
					error instanceof Error
						? error.message
						: 'Unable to connect to the selected thread.',
			}
			update()
		}
	}

	async function syncActiveThreadFromLocation() {
		if (threadStatus !== 'ready' || syncInFlight) return
		syncInFlight = true
		try {
			const locationThreadId = getSelectedThreadIdFromLocation()
			if (threads.length === 0) {
				activeClient?.close()
				activeClient = null
				activeThreadId = null
				resetChatSnapshot()
				update()
				return
			}

			const selectedThread =
				locationThreadId &&
				threads.find((thread) => thread.id === locationThreadId)
					? locationThreadId
					: null
			const resolvedThreadId = selectedThread ?? threads[0]?.id ?? null
			if (!resolvedThreadId) return

			if (locationThreadId !== resolvedThreadId) {
				navigate(buildThreadHref(resolvedThreadId))
				return
			}

			await connectThread(resolvedThreadId)
		} finally {
			syncInFlight = false
		}
	}

	async function refreshThreads(signal?: AbortSignal) {
		setThreadState('loading')
		try {
			threads = await fetchThreads(signal)
			setThreadState('ready')
			await syncActiveThreadFromLocation()
		} catch (error) {
			if (signal?.aborted) return
			setThreadState(
				'error',
				error instanceof Error ? error.message : 'Unable to load threads.',
			)
		}
	}

	handle.queueTask(async (signal) => {
		if (threadStatus !== 'idle') return
		await refreshThreads(signal)
	})

	handle.on(routerEvents, {
		navigate: () => {
			void handle.queueTask(async () => {
				await syncActiveThreadFromLocation()
			})
		},
	})

	async function handleCreateThread() {
		actionError = null
		update()
		try {
			const thread = await createThread()
			threads = [thread, ...threads]
			update()
			navigate(buildThreadHref(thread.id))
			await connectThread(thread.id)
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Unable to create thread.'
			update()
		}
	}

	async function handleDeleteThread(threadId: string) {
		actionError = null
		update()
		try {
			await deleteThread(threadId)
			threads = threads.filter((thread) => thread.id !== threadId)
			if (activeThreadId === threadId) {
				activeClient?.close()
				activeClient = null
				activeThreadId = null
				resetChatSnapshot()
			}
			update()
			const nextThread = threads[0]
			if (nextThread) {
				navigate(buildThreadHref(nextThread.id))
				await connectThread(nextThread.id)
			} else {
				navigate('/chat')
			}
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Unable to delete thread.'
			update()
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		actionError = null
		if (!(event.currentTarget instanceof HTMLFormElement)) return
		const formData = new FormData(event.currentTarget)
		const text = String(formData.get('message') ?? '').trim()
		if (!text) return

		if (!activeClient) {
			actionError = 'Select or create a thread first.'
			update()
			return
		}

		try {
			activeClient.sendMessage(text)
			event.currentTarget.reset()
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Unable to send message.'
			update()
		}
	}

	return () => {
		const activeThread =
			activeThreadId && threads.find((thread) => thread.id === activeThreadId)
				? (threads.find((thread) => thread.id === activeThreadId) ?? null)
				: null

		return (
			<section
				css={{
					display: 'grid',
					gap: spacing.lg,
				}}
			>
				<header
					css={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						gap: spacing.md,
					}}
				>
					<div css={{ display: 'grid', gap: spacing.xs }}>
						<h2
							css={{
								fontSize: typography.fontSize.xl,
								fontWeight: typography.fontWeight.semibold,
								margin: 0,
								color: colors.text,
							}}
						>
							Chat
						</h2>
						<p css={{ margin: 0, color: colors.textMuted }}>
							Start a thread to chat with the assistant and use the attached MCP
							tools.
						</p>
					</div>
					<button
						type="button"
						on={{ click: handleCreateThread }}
						css={{
							padding: `${spacing.sm} ${spacing.md}`,
							borderRadius: radius.full,
							border: 'none',
							backgroundColor: colors.primary,
							color: colors.onPrimary,
							fontWeight: typography.fontWeight.semibold,
							cursor: 'pointer',
							transition: `background-color ${transitions.normal}`,
							'&:hover': {
								backgroundColor: colors.primaryHover,
							},
						}}
					>
						New thread
					</button>
				</header>

				{actionError ? (
					<p css={{ margin: 0, color: colors.error }}>{actionError}</p>
				) : null}

				<div
					css={{
						display: 'grid',
						gap: spacing.lg,
						gridTemplateColumns: '18rem minmax(0, 1fr)',
						alignItems: 'start',
					}}
				>
					<aside
						css={{
							display: 'grid',
							gap: spacing.sm,
							padding: spacing.md,
							borderRadius: radius.lg,
							border: `1px solid ${colors.border}`,
							backgroundColor: colors.surface,
							boxShadow: shadows.sm,
						}}
					>
						<h3 css={{ margin: 0, color: colors.text }}>Threads</h3>
						{threadStatus === 'error' ? (
							<p css={{ margin: 0, color: colors.error }}>{threadError}</p>
						) : null}
						{threadStatus === 'ready' && threads.length === 0 ? (
							<p css={{ margin: 0, color: colors.textMuted }}>
								No conversations yet. Create a thread to start asking questions,
								trigger tools, or try the local mock command `help`.
							</p>
						) : null}
						{threads.map((thread) => {
							const isActive = thread.id === activeThreadId
							return (
								<div
									key={thread.id}
									css={{
										display: 'grid',
										gap: spacing.xs,
										padding: spacing.sm,
										borderRadius: radius.md,
										border: `1px solid ${
											isActive ? colors.primary : colors.border
										}`,
										backgroundColor: isActive
											? colors.primarySoftest
											: colors.surface,
									}}
								>
									<a
										href={buildThreadHref(thread.id)}
										css={{
											color: colors.text,
											textDecoration: 'none',
											fontWeight: typography.fontWeight.semibold,
										}}
									>
										{thread.title}
									</a>
									{thread.lastMessagePreview ? (
										<p
											css={{
												margin: 0,
												color: colors.textMuted,
												fontSize: typography.fontSize.sm,
											}}
										>
											{thread.lastMessagePreview}
										</p>
									) : null}
									<div
										css={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											gap: spacing.sm,
										}}
									>
										<span
											css={{
												color: colors.textMuted,
												fontSize: typography.fontSize.sm,
											}}
										>
											{thread.messageCount} message
											{thread.messageCount === 1 ? '' : 's'}
										</span>
										<button
											type="button"
											on={{ click: () => handleDeleteThread(thread.id) }}
											css={{
												padding: `${spacing.xs} ${spacing.sm}`,
												borderRadius: radius.full,
												border: `1px solid ${colors.border}`,
												backgroundColor: 'transparent',
												color: colors.textMuted,
												cursor: 'pointer',
											}}
										>
											Delete
										</button>
									</div>
								</div>
							)
						})}
					</aside>

					<div
						css={{
							display: 'grid',
							gap: spacing.md,
							padding: spacing.lg,
							borderRadius: radius.lg,
							border: `1px solid ${colors.border}`,
							backgroundColor: colors.surface,
							boxShadow: shadows.sm,
							minHeight: '30rem',
						}}
					>
						{activeThread ? (
							<>
								<div
									css={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										gap: spacing.md,
									}}
								>
									<div css={{ display: 'grid', gap: spacing.xs }}>
										<h3 css={{ margin: 0, color: colors.text }}>
											{activeThread.title}
										</h3>
										<p css={{ margin: 0, color: colors.textMuted }}>
											{chatSnapshot.connected ? 'Connected' : 'Connecting…'}
										</p>
									</div>
								</div>

								<div
									css={{
										display: 'grid',
										gap: spacing.md,
										alignContent: 'start',
									}}
								>
									{chatSnapshot.messages.map((message) => (
										<article
											key={message.id}
											css={{
												display: 'grid',
												gap: spacing.xs,
												padding: spacing.md,
												borderRadius: radius.md,
												backgroundColor:
													message.role === 'user'
														? colors.primarySoftest
														: colors.surface,
												border: `1px solid ${colors.border}`,
											}}
										>
											<strong css={{ color: colors.text }}>
												{message.role === 'user' ? 'You' : 'Assistant'}
											</strong>
											<div css={{ display: 'grid', gap: spacing.sm }}>
												{renderMessageParts(
													message.parts as Array<{
														type: string
														text?: string
														state?: string
														input?: unknown
														output?: unknown
														errorText?: string
													}>,
												)}
											</div>
										</article>
									))}
									{chatSnapshot.isStreaming || chatSnapshot.streamingText ? (
										<article
											css={{
												display: 'grid',
												gap: spacing.xs,
												padding: spacing.md,
												borderRadius: radius.md,
												border: `1px solid ${colors.border}`,
												backgroundColor: colors.surface,
											}}
										>
											<strong css={{ color: colors.text }}>Assistant</strong>
											<p
												css={{
													margin: 0,
													whiteSpace: 'pre-wrap',
													color: colors.text,
												}}
											>
												{chatSnapshot.streamingText || 'Thinking…'}
											</p>
										</article>
									) : null}
								</div>

								{chatSnapshot.error ? (
									<p css={{ margin: 0, color: colors.error }}>
										{chatSnapshot.error}
									</p>
								) : null}

								<form
									on={{ submit: handleSubmit }}
									css={{
										display: 'grid',
										gap: spacing.sm,
									}}
								>
									<label css={{ display: 'grid', gap: spacing.xs }}>
										<span
											css={{
												color: colors.text,
												fontWeight: typography.fontWeight.medium,
											}}
										>
											Message
										</span>
										<textarea
											name="message"
											rows={4}
											placeholder='Ask a question or send "help" when using the local mock.'
											css={{
												padding: spacing.sm,
												borderRadius: radius.md,
												border: `1px solid ${colors.border}`,
												fontFamily: typography.fontFamily,
												fontSize: typography.fontSize.base,
											}}
										/>
									</label>
									<button
										type="submit"
										disabled={chatSnapshot.isStreaming}
										css={{
											justifySelf: 'start',
											padding: `${spacing.sm} ${spacing.lg}`,
											borderRadius: radius.full,
											border: 'none',
											backgroundColor: colors.primary,
											color: colors.onPrimary,
											fontWeight: typography.fontWeight.semibold,
											cursor: chatSnapshot.isStreaming
												? 'not-allowed'
												: 'pointer',
											opacity: chatSnapshot.isStreaming ? 0.7 : 1,
										}}
									>
										{chatSnapshot.isStreaming ? 'Streaming…' : 'Send'}
									</button>
								</form>
							</>
						) : (
							<div
								css={{
									display: 'grid',
									gap: spacing.md,
									alignContent: 'center',
									justifyItems: 'start',
									minHeight: '22rem',
								}}
							>
								<h3 css={{ margin: 0, color: colors.text }}>
									Start a conversation
								</h3>
								<p
									css={{
										margin: 0,
										color: colors.textMuted,
										maxWidth: '36rem',
									}}
								>
									Create a thread to chat with the assistant, use the attached
									MCP tools, and iterate on work without leaving the app. In
									local mock mode, send `help` to see deterministic tool
									triggers you can test.
								</p>
								<button
									type="button"
									on={{ click: handleCreateThread }}
									css={{
										padding: `${spacing.sm} ${spacing.md}`,
										borderRadius: radius.full,
										border: 'none',
										backgroundColor: colors.primary,
										color: colors.onPrimary,
										fontWeight: typography.fontWeight.semibold,
										cursor: 'pointer',
									}}
								>
									Create your first thread
								</button>
							</div>
						)}
					</div>
				</div>
			</section>
		)
	}
}
