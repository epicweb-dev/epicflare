import { type Handle } from 'remix/component'
import { ChatClient, type ChatClientSnapshot } from '#client/chat-client.ts'
import { navigate, routerEvents } from '#client/client-router.tsx'
import { EditableText } from '#client/editable-text.tsx'
import {
	colors,
	radius,
	shadows,
	spacing,
	transitions,
	typography,
} from '#client/styles/tokens.ts'
import {
	type ChatThreadSummary,
	type ChatThreadUpdateResponse,
} from '#shared/chat.ts'

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

const MESSAGES_SCROLL_CONTAINER_ID = 'chat-messages-scroll-container'
const MESSAGES_SCROLL_THRESHOLD_PX = 96

function truncatePreview(text: string) {
	const normalized = text.trim()
	if (!normalized) return ''
	return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
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
	return text ? truncatePreview(text) : null
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

async function updateThreadTitle(threadId: string, title: string) {
	const response = await fetch('/chat-threads/update', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ threadId, title }),
	})
	const payload = (await response.json().catch(() => null)) as
		| (ChatThreadUpdateResponse & { error?: string })
		| { ok?: false; error?: string }
		| null
	if (!response.ok || !payload?.ok || !('thread' in payload) || !payload.thread) {
		throw new Error(payload?.error || 'Unable to update thread title.')
	}
	return payload.thread
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

function renderPaperAirplaneIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			css={{ width: '1.125rem', height: '1.125rem' }}
		>
			<path
				d="M3 11.5 20.5 4l-4.8 16-4.6-5-5.1-3.5Zm8.1 2.2 3 3.2 2.8-9.2-10 4.3 4.2 1.7Z"
				fill="currentColor"
			/>
		</svg>
	)
}

const SEND_BUTTON_SIZE_REM = 2.5
const SEND_BUTTON_INSET_REM = 0.375
const INPUT_MIN_HEIGHT_REM =
	SEND_BUTTON_SIZE_REM + SEND_BUTTON_INSET_REM * 2
const INPUT_MIN_HEIGHT_PX = INPUT_MIN_HEIGHT_REM * 16
const INPUT_MIN_HEIGHT = `${INPUT_MIN_HEIGHT_REM}rem`
const INPUT_RIGHT_PADDING = `${SEND_BUTTON_SIZE_REM + SEND_BUTTON_INSET_REM * 2}rem`
const SEND_BUTTON_SIZE = `${SEND_BUTTON_SIZE_REM}rem`
const SEND_BUTTON_INSET = `${SEND_BUTTON_INSET_REM}rem`
/**
 * The outer border should follow the button's contour plus its inset from the edge.
 * radius = button radius + inset
 */
const SEND_BUTTON_RADIUS = `${SEND_BUTTON_SIZE_REM / 2 + SEND_BUTTON_INSET_REM}rem`

function resizeMessageInput(target: EventTarget | null) {
	if (!(target instanceof HTMLTextAreaElement)) return
	target.style.height = INPUT_MIN_HEIGHT
	const height = Math.max(target.scrollHeight, INPUT_MIN_HEIGHT_PX)
	target.style.height = `${height}px`
}

function isScrolledNearBottom(element: HTMLElement) {
	return (
		element.scrollHeight - element.scrollTop - element.clientHeight <=
		MESSAGES_SCROLL_THRESHOLD_PX
	)
}

export function ChatRoute(handle: Handle) {
	let threads: Array<ChatThreadSummary> = []
	let threadStatus: ThreadStatus = 'loading'
	let threadError: string | null = null
	let activeThreadId: string | null = null
	let chatSnapshot = createInitialSnapshot()
	let activeClient: ChatClient | null = null
	let actionError: string | null = null
	let syncInFlight = false
	let shouldAutoScrollMessages = true

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

	function replaceThreadSummary(nextThread: ChatThreadSummary) {
		threads = threads.map((thread) =>
			thread.id === nextThread.id ? nextThread : thread,
		)
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

	function scheduleScrollToBottom(force = false) {
		void handle.queueTask(async () => {
			const container = document.getElementById(MESSAGES_SCROLL_CONTAINER_ID)
			if (!(container instanceof HTMLDivElement)) return
			if (
				!force &&
				!shouldAutoScrollMessages &&
				!isScrolledNearBottom(container)
			) {
				return
			}
			container.scrollTop = container.scrollHeight
			shouldAutoScrollMessages = true
		})
	}

	function handleMessagesScroll(event: Event) {
		if (!(event.currentTarget instanceof HTMLDivElement)) return
		shouldAutoScrollMessages = isScrolledNearBottom(event.currentTarget)
	}

	function handleComposerKeyDown(event: KeyboardEvent) {
		if (!(event.currentTarget instanceof HTMLTextAreaElement)) return
		if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
		event.preventDefault()
		event.currentTarget.form?.requestSubmit()
	}

	async function connectThread(threadId: string) {
		if (activeThreadId === threadId && activeClient) return

		activeClient?.close()
		shouldAutoScrollMessages = true
		activeClient = new ChatClient({
			threadId,
			onSnapshot(snapshot) {
				if (activeThreadId !== threadId) return
				chatSnapshot = snapshot
				updateLocalThreadSummary(threadId, snapshot)
				update()
				scheduleScrollToBottom()
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

	handle.on(routerEvents, {
		navigate: () => {
			void handle.queueTask(async () => {
				await syncActiveThreadFromLocation()
			})
		},
	})

	async function createAndSelectThread() {
		const thread = await createThread()
		threads = [thread, ...threads]
		update()
		navigate(buildThreadHref(thread.id))
		await connectThread(thread.id)
		return thread
	}

	async function handleCreateThread() {
		actionError = null
		update()
		try {
			await createAndSelectThread()
			await activeClient?.waitUntilConnected()
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

	async function handleRenameThread(threadId: string, title: string) {
		actionError = null
		update()
		try {
			const updatedThread = await updateThreadTitle(threadId, title)
			replaceThreadSummary(updatedThread)
			update()
			return true
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Unable to update thread title.'
			update()
			return false
		}
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault()
		actionError = null
		if (!(event.currentTarget instanceof HTMLFormElement)) return
		const form = event.currentTarget
		const formData = new FormData(form)
		const text = String(formData.get('message') ?? '').trim()
		if (!text) return

		try {
			let client = activeClient

			if (!client) {
				await createAndSelectThread()
				client = activeClient
			}

			if (!client) {
				throw new Error('Unable to start a chat thread.')
			}

			await client.waitUntilConnected()
			client.sendMessage(text)
			form.reset()
			const messageInput = form.elements.namedItem('message')
			resizeMessageInput(
				messageInput instanceof HTMLTextAreaElement ? messageInput : null,
			)
		} catch (error) {
			actionError =
				error instanceof Error ? error.message : 'Unable to send message.'
			update()
		}
	}

	return () => {
		if (threadStatus === 'loading') {
			handle.queueTask(refreshThreads)
		}

		const activeThread = activeThreadId
			? (threads.find((thread) => thread.id === activeThreadId) ?? null)
			: null
		const showEmptyStateComposer =
			!activeThread && threads.length === 0 && threadStatus !== 'error'

		return (
			<section
				css={{
					display: 'grid',
					gap: spacing.lg,
					minHeight: 'calc(100vh - 7rem)',
				}}
			>
				{actionError ? (
					<p css={{ margin: 0, color: colors.error }}>{actionError}</p>
				) : null}

				<div
					css={{
						display: 'grid',
						gap: spacing.lg,
						gridTemplateColumns: '18rem minmax(0, 1fr)',
						alignItems: 'start',
						minHeight: 'calc(100vh - 10rem)',
					}}
				>
					<aside
						css={{
							display: 'grid',
							gap: spacing.md,
							padding: spacing.md,
							borderRadius: radius.lg,
							border: `1px solid ${colors.border}`,
							backgroundColor: colors.surface,
							boxShadow: shadows.sm,
							alignContent: 'start',
							position: 'sticky',
							top: spacing.lg,
							minHeight: 'calc(100vh - 10rem)',
						}}
					>
						<button
							type="button"
							on={{ click: handleCreateThread }}
							css={{
								width: '100%',
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
						<h2
							css={{
								margin: 0,
								color: colors.text,
								fontSize: typography.fontSize.lg,
								fontWeight: typography.fontWeight.semibold,
							}}
						>
							Chats
						</h2>
						{threadStatus === 'error' ? (
							<p css={{ margin: 0, color: colors.error }}>{threadError}</p>
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
										transition: `background-color ${transitions.normal}, border-color ${transitions.normal}`,
									}}
								>
									<a
										href={buildThreadHref(thread.id)}
										css={{
											color: colors.text,
											textDecoration: 'none',
											fontWeight: typography.fontWeight.semibold,
											fontSize: typography.fontSize.sm,
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
												whiteSpace: 'pre-wrap',
												wordBreak: 'break-word',
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
							display: 'flex',
							flexDirection: 'column',
							gap: spacing.md,
							padding: spacing.xl,
							borderRadius: radius.lg,
							border: `1px solid ${colors.border}`,
							backgroundColor: colors.surface,
							boxShadow: shadows.sm,
							minHeight: 'calc(100vh - 10rem)',
							overflow: 'hidden',
						}}
					>
						{activeThread ? (
							<>
								<div
									css={{
										flexShrink: 0,
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										gap: spacing.md,
									}}
								>
									<div css={{ display: 'grid', gap: spacing.xs, minWidth: 0 }}>
										<h3 css={{ margin: 0, color: colors.text, minWidth: 0 }}>
											<EditableText
												id={`thread-title-${activeThread.id}`}
												ariaLabel="Chat title"
												value={activeThread.title}
												onSave={(value) =>
													handleRenameThread(activeThread.id, value)
												}
												buttonCss={{
													whiteSpace: 'nowrap',
													overflow: 'hidden',
													textOverflow: 'ellipsis',
												}}
											/>
										</h3>
										<p css={{ margin: 0, color: colors.textMuted }}>
											{chatSnapshot.connected ? 'Connected' : 'Connecting…'}
										</p>
									</div>
								</div>

								<div
									id={MESSAGES_SCROLL_CONTAINER_ID}
									on={{ scroll: handleMessagesScroll }}
									css={{
										flex: 1,
										overflowY: 'auto',
										minHeight: 0,
										display: 'grid',
										gap: spacing.md,
										alignContent: 'start',
										maxWidth: '56rem',
										width: '100%',
										margin: '0 auto',
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
										maxWidth: '56rem',
										width: '100%',
										margin: '0 auto',
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
										<div
											css={{
												position: 'relative',
											}}
										>
											<textarea
												name="message"
												rows={1}
												on={{
													input: (event) =>
														resizeMessageInput(event.currentTarget),
													keydown: handleComposerKeyDown,
												}}
												placeholder='Ask a question or send "help" when using the local mock.'
												css={{
													display: 'block',
													width: '100%',
													height: INPUT_MIN_HEIGHT,
													minHeight: INPUT_MIN_HEIGHT,
													padding: '0.75rem',
													paddingRight: INPUT_RIGHT_PADDING,
													borderRadius: SEND_BUTTON_RADIUS,
													border: `1px solid ${colors.border}`,
													fontFamily: typography.fontFamily,
													fontSize: typography.fontSize.base,
													lineHeight: 1.4,
													overflow: 'hidden',
													resize: 'none',
												}}
											/>
											<button
												type="submit"
												disabled={chatSnapshot.isStreaming}
												aria-label={
													chatSnapshot.isStreaming
														? 'Streaming'
														: 'Send message'
												}
												title={
													chatSnapshot.isStreaming
														? 'Streaming'
														: 'Send message'
												}
												css={{
													display: 'inline-flex',
													alignItems: 'center',
													justifyContent: 'center',
													position: 'absolute',
													right: SEND_BUTTON_INSET,
													bottom: SEND_BUTTON_INSET,
													width: SEND_BUTTON_SIZE,
													height: SEND_BUTTON_SIZE,
													padding: 0,
													borderRadius: radius.full,
													border: 'none',
													backgroundColor: colors.primary,
													color: colors.onPrimary,
													cursor: chatSnapshot.isStreaming
														? 'not-allowed'
														: 'pointer',
													opacity: chatSnapshot.isStreaming ? 0.7 : 1,
												}}
											>
												{renderPaperAirplaneIcon()}
											</button>
										</div>
									</label>
								</form>
							</>
						) : showEmptyStateComposer ? (
							<div
								css={{
									flex: 1,
									minHeight: 0,
									display: 'flex',
									flexDirection: 'column',
									justifyContent: 'flex-end',
									maxWidth: '56rem',
									margin: '0 auto',
									width: '100%',
									paddingBottom: spacing.sm,
								}}
							>
								<form
									on={{ submit: handleSubmit }}
									css={{
										display: 'grid',
										gap: spacing.sm,
										width: '100%',
									}}
								>
									<div
										css={{
											position: 'relative',
										}}
									>
										<textarea
											name="message"
											rows={1}
											aria-label="Message"
											on={{
												input: (event) =>
													resizeMessageInput(event.currentTarget),
												keydown: handleComposerKeyDown,
											}}
											placeholder='Ask a question or send "help" when using the local mock.'
											css={{
												display: 'block',
												width: '100%',
												height: INPUT_MIN_HEIGHT,
												minHeight: INPUT_MIN_HEIGHT,
												padding: '0.75rem',
												paddingRight: INPUT_RIGHT_PADDING,
												borderRadius: SEND_BUTTON_RADIUS,
												border: `1px solid ${colors.border}`,
												fontFamily: typography.fontFamily,
												fontSize: typography.fontSize.base,
												lineHeight: 1.4,
												overflow: 'hidden',
												resize: 'none',
											}}
										/>
										<button
											type="submit"
											aria-label="Send message"
											title="Send message"
											css={{
												display: 'inline-flex',
												alignItems: 'center',
												justifyContent: 'center',
												position: 'absolute',
												right: SEND_BUTTON_INSET,
												bottom: SEND_BUTTON_INSET,
												width: SEND_BUTTON_SIZE,
												height: SEND_BUTTON_SIZE,
												padding: 0,
												borderRadius: radius.full,
												border: 'none',
												backgroundColor: colors.primary,
												color: colors.onPrimary,
												cursor: 'pointer',
											}}
										>
											{renderPaperAirplaneIcon()}
										</button>
									</div>
								</form>
							</div>
						) : null}
					</div>
				</div>
			</section>
		)
	}
}
