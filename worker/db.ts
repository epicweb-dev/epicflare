import { createDatabase, createTable, sql } from 'remix/data-table'
import { number, string } from 'remix/data-schema'
import { createD1DataTableAdapter } from './d1-data-table-adapter.ts'

export const usersTable = createTable({
	name: 'users',
	columns: {
		id: number(),
		username: string(),
		email: string(),
		password_hash: string(),
		created_at: string(),
		updated_at: string(),
	},
	primaryKey: 'id',
})

export const passwordResetsTable = createTable({
	name: 'password_resets',
	columns: {
		id: number(),
		user_id: number(),
		token_hash: string(),
		expires_at: number(),
		created_at: string(),
	},
	primaryKey: 'id',
})

export const mockResendMessagesTable = createTable({
	name: 'mock_resend_messages',
	columns: {
		id: string(),
		token_hash: string(),
		received_at: number(),
		from_email: string(),
		to_json: string(),
		subject: string(),
		html: string(),
		payload_json: string(),
	},
	primaryKey: 'id',
})

export function createDb(db: D1Database) {
	return createDatabase(createD1DataTableAdapter(db))
}

export type AppDatabase = ReturnType<typeof createDb>
export { sql }
