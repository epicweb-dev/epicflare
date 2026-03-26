import { column, createDatabase, sql, table } from 'remix/data-table'
import { createD1DataTableAdapter } from './d1-data-table-adapter.ts'

export const usersTable = table({
	name: 'users',
	columns: {
		id: column.integer().primaryKey(),
		username: column.text(),
		email: column.text(),
		password_hash: column.text(),
		created_at: column.text(),
		updated_at: column.text(),
	},
	primaryKey: 'id',
})

export const passwordResetsTable = table({
	name: 'password_resets',
	columns: {
		id: column.integer().primaryKey(),
		user_id: column.integer(),
		token_hash: column.text(),
		expires_at: column.integer(),
		created_at: column.text(),
	},
	primaryKey: 'id',
})

export const chatThreadsTable = table({
	name: 'chat_threads',
	columns: {
		id: column.text().primaryKey(),
		user_id: column.integer(),
		title: column.text(),
		last_message_preview: column.text(),
		message_count: column.integer(),
		created_at: column.text(),
		updated_at: column.text(),
		deleted_at: column.text().nullable(),
	},
	primaryKey: 'id',
	timestamps: {
		createdAt: 'created_at',
		updatedAt: 'updated_at',
	},
})

export function createDb(db: D1Database) {
	return createDatabase(createD1DataTableAdapter(db), {
		now: () => new Date().toISOString(),
	})
}

export type AppDatabase = ReturnType<typeof createDb>
export { sql }
