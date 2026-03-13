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

export function createChatThreadsStore(db: D1Database) {
	const database = createDb(db)

	return {
		async listForUser(userId: number) {
			const records = await database.findMany(chatThreadsTable, {
				where: { user_id: userId, deleted_at: null },
				orderBy: ['updated_at', 'desc'],
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
