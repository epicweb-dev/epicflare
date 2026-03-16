import { chatThreadsTable, createDb } from '#worker/db.ts'
import { type ChatThreadSummary } from '#shared/chat.ts'

function toIsoTimestamp(date = new Date()) {
	return date.toISOString()
}

function normalizePreview(value: string | null | undefined) {
	const trimmed = value?.trim() ?? ''
	return trimmed.length > 0 ? trimmed : ''
}

function buildThreadTitleFallback(threadId: string) {
	return `Thread ${threadId.slice(0, 8)}`
}

function toThreadSummary(record: {
	id: string
	title: string
	last_message_preview: string
	message_count: number
	created_at: string
	updated_at: string
	deleted_at?: string | null
}): ChatThreadSummary {
	const title = record.title.trim()
	return {
		id: record.id,
		title: title || buildThreadTitleFallback(record.id),
		lastMessagePreview: normalizePreview(record.last_message_preview) || null,
		messageCount: record.message_count,
		createdAt: record.created_at,
		updatedAt: record.updated_at,
		deletedAt: record.deleted_at ?? null,
	}
}

function normalizeThreadTitle(value: string) {
	const trimmed = value.trim()
	if (!trimmed) return ''
	return trimmed.slice(0, 120)
}

function buildInitialTitle() {
	return 'New chat'
}

const defaultThreadListLimit = 100

export function createChatThreadsStore(db: D1Database) {
	const database = createDb(db)

	return {
		async listForUser(
			userId: number,
			options?: {
				limit?: number
				search?: string
			},
		) {
			const limit = Math.max(
				1,
				Math.min(options?.limit ?? defaultThreadListLimit, defaultThreadListLimit),
			)
			const search = options?.search?.trim() ?? ''
			const records = search
				? await db
						.prepare(
							`
								SELECT
									id,
									title,
									last_message_preview,
									message_count,
									created_at,
									updated_at,
									deleted_at
								FROM chat_threads
								WHERE
									user_id = ?
									AND deleted_at IS NULL
									AND (
										lower(title) LIKE lower(?)
										OR lower(last_message_preview) LIKE lower(?)
									)
								ORDER BY updated_at DESC
								LIMIT ?
							`,
						)
						.bind(userId, `%${search}%`, `%${search}%`, limit)
						.all()
						.then((result) => result.results as Array<{
							id: string
							title: string
							last_message_preview: string
							message_count: number
							created_at: string
							updated_at: string
							deleted_at?: string | null
						}>)
				: await database.findMany(chatThreadsTable, {
						where: { user_id: userId, deleted_at: null },
						orderBy: ['updated_at', 'desc'],
						limit,
					})
			return records.map(toThreadSummary)
		},
		async createForUser(userId: number) {
			const record = await database.create(
				chatThreadsTable,
				{
					id: crypto.randomUUID(),
					user_id: userId,
					title: buildInitialTitle(),
					last_message_preview: '',
					message_count: 0,
				},
				{ returnRow: true },
			)
			return toThreadSummary(record)
		},
		async getForUser(userId: number, threadId: string) {
			const record = await database.findOne(chatThreadsTable, {
				where: { id: threadId, user_id: userId, deleted_at: null },
			})
			return record ? toThreadSummary(record) : null
		},
		async renameForUser(userId: number, threadId: string, title: string) {
			const record = await database.findOne(chatThreadsTable, {
				where: { id: threadId, user_id: userId, deleted_at: null },
			})
			if (!record) return null

			const updated = await database.update(
				chatThreadsTable,
				threadId,
				{ title: normalizeThreadTitle(title) },
				{ touch: true },
			)
			return toThreadSummary(updated)
		},
		async markDeletedForUser(userId: number, threadId: string) {
			const record = await database.findOne(chatThreadsTable, {
				where: { id: threadId, user_id: userId, deleted_at: null },
			})
			if (!record) return false
			await database.update(
				chatThreadsTable,
				threadId,
				{ deleted_at: toIsoTimestamp() },
				{ touch: true },
			)
			return true
		},
		async syncMetadataForUser(input: {
			userId: number
			threadId: string
			title?: string
			lastMessagePreview?: string | null
			messageCount?: number
		}) {
			const record = await database.findOne(chatThreadsTable, {
				where: {
					id: input.threadId,
					user_id: input.userId,
					deleted_at: null,
				},
			})
			if (!record) return null

			const nextTitle =
				typeof input.title === 'string'
					? normalizeThreadTitle(input.title)
					: record.title
			const nextPreview =
				input.lastMessagePreview !== undefined
					? normalizePreview(input.lastMessagePreview)
					: record.last_message_preview
			const nextMessageCount =
				typeof input.messageCount === 'number'
					? input.messageCount
					: record.message_count

			const updated = await database.update(
				chatThreadsTable,
				input.threadId,
				{
					title: nextTitle,
					last_message_preview: nextPreview,
					message_count: nextMessageCount,
				},
				{ touch: true },
			)
			return toThreadSummary(updated)
		},
	}
}
