import { type Handle } from 'remix/component'
import { ChatClient, type ChatClientSnapshot } from '#client/chat-client.ts'
import { navigate, routerEvents } from '#client/client-router.tsx'
import { createDoubleCheck } from '#client/double-check.ts'
import { EditableText } from '#client/editable-text.tsx'
import { createSpinDelay } from '#client/spin-delay.ts'
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
const THREAD_LIST_SCROLL_CONTAINER_ID = 'chat-thread-list-scroll-container'
const MESSAGES_SCROLL_THRESHOLD_PX = 96
const MESSAGE_SCROLL_FADE_HEIGHT = '2.5rem'

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

async function fetchThreads(input?: {
	signal?: AbortSignal
	search?: string
}) {
	const url = new URL('/chat-threads', window.location.href)
	const search = input?.search?.trim()
	if (search) {
		url.searchParams.set('q', search)
	}
	const response = await fetch(url.toString(), {
		credentials: 'include',
		headers: { Accept: 'application/json' },
		signal: input?.signal,
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
	if (
		!response.ok ||
		!payload?.ok ||
		!('thread' in payload) ||
		!payload.thread
	) {
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
				d="M21 3 10 14"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.75"
			/>
			<path
				d="m21 3-7 18-4-7-7-4 18-7Z"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.75"
			/>
		</svg>
	)
}

function renderTrashIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			css={{ width: '1rem', height: '1rem' }}
		>
			<path
				d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h2v8H7V9Zm4 0h2v8h-2V9Zm4 0h2v8h-2V9ZM6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7Z"
				fill="currentColor"
			/>
		</svg>
	)
}

const SEND_BUTTON_SIZE_REM = 2.5
const SEND_BUTTON_INSET_REM = 0.375
const INPUT_MIN_HEIGHT_REM = SEND_BUTTON_SIZE_REM + SEND_BUTTON_INSET_REM * 2
const INPUT_MIN_HEIGHT_PX = INPUT_MIN_HEIGHT_REM * 16
const INPUT_MIN_HEIGHT = `${INPUT_MIN_HEIGHT_REM}rem`
const INPUT_RIGHT_PADDING = `${SEND_BUTTON_SIZE_REM + SEND_BUTTON_INSET_REM * 2}rem`
const SEND_BUTTON_SIZE = `${SEND_BUTTON_SIZE_REM}rem`
const SEND_BUTTON_INSET = `${SEND_BUTTON_INSET_REM}rem`
const CHAT_PANEL_HEIGHT = 'calc(100vh - 7rem)'
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
	let threadSearch = ''
	let chatSnapshot = createInitialSnapshot()
	let activeClient: ChatClient | null = null
	let actionError: string | null = null
	let syncInFlight = false
	let shouldAutoScrollMessages = true
	let showMessageScrollFadeTop = false
	let showMessageScrollFadeBottom = false
	let showThreadListScrollFadeTop = false
	let showThreadListScrollFadeBottom = false
	const disconnectedIndicator = createSpinDelay(handle, { ssr: false })
	const deleteThreadChecks = new Map<
		string,
		ReturnType<typeof createDoubleCheck>
	>()

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

	function syncDisconnectedIndicator() {
		disconnectedIndicator.setLoading(
			Boolean(activeThreadId) && !chatSnapshot.connected,
		)
	}

	function setMessageScrollFades(
		nextTopVisible: boolean,
		nextBottomVisible: boolean,
	) {
		if (
			showMessageScrollFadeTop === nextTopVisible &&
			showMessageScrollFadeBottom === nextBottomVisible
		) {
			return
		}

		showMessageScrollFadeTop = nextTopVisible
		showMessageScrollFadeBottom = nextBottomVisible
		update()
	}

	function syncMessageScrollFades(target?: HTMLDivElement | null) {
		const container =
			target ??
			(() => {
				const element = document.getElementById(MESSAGES_SCROLL_CONTAINER_ID)
				return element instanceof HTMLDivElement ? element : null
			})()
		if (!container) {
			setMessageScrollFades(false, false)
			return
		}

		const canScroll = container.scrollHeight > container.clientHeight + 1
		if (!canScroll) {
			setMessageScrollFades(false, false)
			return
		}

		const topVisible = container.scrollTop > 1
		const bottomVisible =
			container.scrollTop + container.clientHeight < container.scrollHeight - 1
		setMessageScrollFades(topVisible, bottomVisible)
	}

	function scheduleMessageScrollFadeSync() {
		void handle.queueTask(async () => {
			syncMessageScrollFades()
		})
	}

	function setThreadListScrollFades(
		nextTopVisible: boolean,
		nextBottomVisible: boolean,
	) {
		if (
			showThreadListScrollFadeTop === nextTopVisible &&
			showThreadListScrollFadeBottom === nextBottomVisible
		) {
			return
		}

		showThreadListScrollFadeTop = nextTopVisible
		showThreadListScrollFadeBottom = nextBottomVisible
		update()
	}

	function syncThreadListScrollFades(target?: HTMLDivElement | null) {
		const container =
			target ??
			(() => {
				const element = document.getElementById(THREAD_LIST_SCROLL_CONTAINER_ID)
				return element instanceof HTMLDivElement ? element : null
			})()
		if (!container) {
			setThreadListScrollFades(false, false)
			return
		}

		const canScroll = container.scrollHeight > container.clientHeight + 1
		if (!canScroll) {
			setThreadListScrollFades(false, false)
			return
		}

		const topVisible = container.scrollTop > 1
		const bottomVisible =
			container.scrollTop + container.clientHeight < container.scrollHeight - 1
		setThreadListScrollFades(topVisible, bottomVisible)
	}

	function scheduleThreadListScrollFadeSync() {
		void handle.queueTask(async () => {
			syncThreadListScrollFades()
		})
	}

	function scheduleScrollToBottom(force = false) {
		void handle.queueTask(async () => {
			const container = document.getElementById(MESSAGES_SCROLL_CONTAINER_ID)
			if (!(container instanceof HTMLDivElement)) {
				setMessageScrollFades(false, false)
				return
			}
			if (
				!force &&
				!shouldAutoScrollMessages &&
				!isScrolledNearBottom(container)
			) {
				syncMessageScrollFades(container)
				return
			}
			container.scrollTop = container.scrollHeight
			shouldAutoScrollMessages = true
			syncMessageScrollFades(container)
		})
	}

	function handleMessagesScroll(event: Event) {
		if (!(event.currentTarget instanceof HTMLDivElement)) return
		shouldAutoScrollMessages = isScrolledNearBottom(event.currentTarget)
		syncMessageScrollFades(event.currentTarget)
	}

	function handleThreadListScroll(event: Event) {
		if (!(event.currentTarget instanceof HTMLDivElement)) return
		syncThreadListScrollFades(event.currentTarget)
	}

	function handleThreadSearchInput(event: Event) {
		if (!(event.currentTarget instanceof HTMLInputElement)) return
		threadSearch = event.currentTarget.value
		update()
		void handle.queueTask(async (signal) => {
			await refreshThreads(signal)
		})
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
				syncDisconnectedIndicator()
				update()
				scheduleMessageScrollFadeSync()
				scheduleThreadListScrollFadeSync()
				scheduleScrollToBottom()
			},
		})
		activeThreadId = threadId
		resetChatSnapshot()
		syncDisconnectedIndicator()
		setMessageScrollFades(false, false)
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
			syncDisconnectedIndicator()
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
				disconnectedIndicator.reset()
				setMessageScrollFades(false, false)
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
			threads = await fetchThreads({ signal, search: threadSearch })
			setThreadState('ready')
			scheduleThreadListScrollFadeSync()
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
			deleteThreadChecks.delete(threadId)
			threads = threads.filter((thread) => thread.id !== threadId)
			if (activeThreadId === threadId) {
				activeClient?.close()
				activeClient = null
				activeThreadId = null
				resetChatSnapshot()
				disconnectedIndicator.reset()
			}
			update()
			scheduleThreadListScrollFadeSync()
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
				error instanceof Error
					? error.message
					: 'Unable to update thread title.'
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
					minHeight: showEmptyStateComposer
						? 'calc(100vh - 7rem)'
						: undefined,
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
						alignItems: 'stretch',
						minHeight: CHAT_PANEL_HEIGHT,
					}}
				>
					<aside
						css={{
							display: 'flex',
							flexDirection: 'column',
							gap: spacing.md,
							padding: spacing.md,
							borderRadius: radius.lg,
							border: `1px solid ${colors.border}`,
							backgroundColor: colors.surface,
							boxShadow: shadows.sm,
							position: 'sticky',
							top: spacing.lg,
							height: CHAT_PANEL_HEIGHT,
							overflow: 'hidden',
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
						<input
							type="search"
							value={threadSearch}
							placeholder="Search chats"
							aria-label="Search chats"
							on={{ input: handleThreadSearchInput }}
							css={{
								width: '100%',
								padding: `${spacing.xs} ${spacing.sm}`,
								borderRadius: radius.md,
								border: `1px solid ${colors.border}`,
								backgroundColor: colors.background,
								color: colors.text,
								fontFamily: typography.fontFamily,
								fontSize: typography.fontSize.sm,
							}}
						/>
						{threadStatus === 'error' ? (
							<p css={{ margin: 0, color: colors.error }}>{threadError}</p>
						) : null}
						<div
							css={{
								flex: 1,
								minHeight: 0,
								position: 'relative',
							}}
						>
							<div
								id={THREAD_LIST_SCROLL_CONTAINER_ID}
								on={{ scroll: handleThreadListScroll }}
								css={{
									height: '100%',
									overflowY: 'auto',
									display: 'grid',
									gap: spacing.md,
									alignContent: 'start',
								}}
							>
								{threads.map((thread) => {
									let deleteThreadCheck = deleteThreadChecks.get(thread.id)
									if (!deleteThreadCheck) {
										deleteThreadCheck = createDoubleCheck(handle)
										deleteThreadChecks.set(thread.id, deleteThreadCheck)
									}
									const isActive = thread.id === activeThreadId
									return (
										<div
											key={thread.id}
											css={{
												position: 'relative',
												'&:hover [data-thread-delete-button="true"], &:focus-within [data-thread-delete-button="true"]':
													{
														opacity: 1,
														pointerEvents: 'auto',
													},
											}}
										>
											<button
												type="button"
												on={{ click: () => navigate(buildThreadHref(thread.id)) }}
												css={{
													display: 'grid',
													gap: spacing.xs,
													width: '100%',
													padding: spacing.sm,
													borderRadius: radius.md,
													border: `1px solid ${
														isActive ? colors.primary : colors.border
													}`,
													backgroundColor: isActive
														? colors.primarySoftest
														: colors.surface,
													color: colors.text,
													textAlign: 'left',
													cursor: 'pointer',
													transition: `background-color ${transitions.normal}, border-color ${transitions.normal}`,
												}}
											>
												<strong
													css={{
														display: 'block',
														width: '100%',
														fontWeight: typography.fontWeight.semibold,
														fontSize: typography.fontSize.sm,
														lineHeight: 1.4,
													}}
												>
													{thread.title}
												</strong>
												{thread.lastMessagePreview ? (
													<p
														css={{
															margin: 0,
															display: 'block',
															width: '100%',
															color: colors.textMuted,
															fontSize: typography.fontSize.sm,
															whiteSpace: 'nowrap',
															overflow: 'hidden',
															textOverflow: 'ellipsis',
														}}
													>
														{thread.lastMessagePreview}
													</p>
												) : null}
												<span
													css={{
														display: 'block',
														width: '100%',
														paddingRight: `calc(${spacing.sm} + 4.5rem)`,
														color: colors.textMuted,
														fontSize: typography.fontSize.sm,
													}}
												>
													{thread.messageCount} message
													{thread.messageCount === 1 ? '' : 's'}
												</span>
											</button>
											<button
												type="button"
												data-thread-delete-button="true"
												{...deleteThreadCheck.getButtonProps({
													on: {
														click: () => handleDeleteThread(thread.id),
													},
												})}
												aria-label={
													deleteThreadCheck.doubleCheck
														? `Confirm delete chat "${thread.title}"`
														: `Delete chat "${thread.title}"`
												}
												title={
													deleteThreadCheck.doubleCheck
														? `Click again to delete "${thread.title}"`
														: `Delete chat "${thread.title}"`
												}
												css={{
													position: 'absolute',
													right: spacing.sm,
													bottom: spacing.sm,
													display: 'inline-flex',
													alignItems: 'center',
													justifyContent: 'center',
													minWidth: '2rem',
													height: '2rem',
													padding: deleteThreadCheck.doubleCheck
														? `0 ${spacing.sm}`
														: 0,
													borderRadius: deleteThreadCheck.doubleCheck
														? radius.md
														: radius.full,
													border: `1px solid ${
														deleteThreadCheck.doubleCheck
															? colors.dangerHover
															: colors.border
													}`,
													backgroundColor: deleteThreadCheck.doubleCheck
														? colors.danger
														: colors.surface,
													color: deleteThreadCheck.doubleCheck
														? colors.onDanger
														: colors.textMuted,
													cursor: 'pointer',
													opacity: 0,
													pointerEvents: 'none',
													transition: `opacity ${transitions.normal}, background-color ${transitions.normal}, border-color ${transitions.normal}, color ${transitions.normal}`,
													'&:hover': {
														backgroundColor: colors.danger,
														borderColor: colors.dangerHover,
														color: colors.onDanger,
													},
													'&:focus-visible': {
														backgroundColor: colors.danger,
														borderColor: colors.dangerHover,
														color: colors.onDanger,
														outline: `2px solid ${colors.danger}`,
														outlineOffset: '2px',
													},
													fontSize: typography.fontSize.sm,
													fontWeight: typography.fontWeight.semibold,
													whiteSpace: 'nowrap',
												}}
											>
												{deleteThreadCheck.doubleCheck
													? 'Confirm'
													: renderTrashIcon()}
											</button>
										</div>
									)
								})}
								{threadStatus === 'ready' &&
								threads.length === 0 &&
								threadSearch.trim() ? (
									<p
										css={{
											margin: 0,
											color: colors.textMuted,
											fontSize: typography.fontSize.sm,
										}}
									>
										No chats match your search.
									</p>
								) : null}
							</div>
							{showThreadListScrollFadeTop ? (
								<div
									aria-hidden="true"
									css={{
										position: 'absolute',
										top: 0,
										left: 0,
										right: 0,
										height: MESSAGE_SCROLL_FADE_HEIGHT,
										background: `linear-gradient(to bottom, ${colors.surface}, color-mix(in srgb, ${colors.surface} 0%, transparent))`,
										pointerEvents: 'none',
									}}
								/>
							) : null}
							{showThreadListScrollFadeBottom ? (
								<div
									aria-hidden="true"
									css={{
										position: 'absolute',
										left: 0,
										right: 0,
										bottom: 0,
										height: MESSAGE_SCROLL_FADE_HEIGHT,
										background: `linear-gradient(to top, ${colors.surface}, color-mix(in srgb, ${colors.surface} 0%, transparent))`,
										pointerEvents: 'none',
									}}
								/>
							) : null}
						</div>
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
							height: CHAT_PANEL_HEIGHT,
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
									<div
										css={{
											position: 'relative',
											minWidth: 0,
										}}
									>
										<span
											aria-hidden={!disconnectedIndicator.isShowing}
											aria-label={
												disconnectedIndicator.isShowing
													? 'Not connected'
													: undefined
											}
											title={
												disconnectedIndicator.isShowing
													? 'Chat is not connected'
													: undefined
											}
											css={{
												position: 'absolute',
												left: `calc(-1 * ${spacing.md})`,
												top: '50%',
												width: '0.5rem',
												height: '0.5rem',
												borderRadius: radius.full,
												backgroundColor: colors.danger,
												transform: disconnectedIndicator.isShowing
													? 'translateY(-50%) scale(1)'
													: 'translateY(-50%) scale(0.85)',
												boxShadow: `0 0 0 2px ${colors.surface}`,
												opacity: disconnectedIndicator.isShowing ? 1 : 0,
												pointerEvents: disconnectedIndicator.isShowing
													? 'auto'
													: 'none',
												transition: `opacity ${transitions.normal}, transform ${transitions.normal}`,
											}}
										/>
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
									</div>
								</div>

								<div
								css={{
									position: 'relative',
									flex: 1,
									minHeight: 0,
									maxWidth: '56rem',
									width: '100%',
									margin: '0 auto',
								}}
							>
								<div
									id={MESSAGES_SCROLL_CONTAINER_ID}
									on={{ scroll: handleMessagesScroll }}
									css={{
										overflowY: 'auto',
										height: '100%',
										minHeight: 0,
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
								{showMessageScrollFadeTop ? (
									<div
										aria-hidden="true"
										css={{
											position: 'absolute',
											top: 0,
											left: 0,
											right: 0,
											height: MESSAGE_SCROLL_FADE_HEIGHT,
											background: `linear-gradient(to bottom, ${colors.surface}, color-mix(in srgb, ${colors.surface} 0%, transparent))`,
											pointerEvents: 'none',
										}}
									/>
								) : null}
								{showMessageScrollFadeBottom ? (
									<div
										aria-hidden="true"
										css={{
											position: 'absolute',
											left: 0,
											right: 0,
											bottom: 0,
											height: MESSAGE_SCROLL_FADE_HEIGHT,
											background: `linear-gradient(to top, ${colors.surface}, color-mix(in srgb, ${colors.surface} 0%, transparent))`,
											pointerEvents: 'none',
										}}
									/>
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
