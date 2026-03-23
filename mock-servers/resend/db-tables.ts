import { createTable } from 'remix/data-table'
import { number, string } from 'remix/data-schema'

export const resendCapturedEmailsTable = createTable({
	name: 'resend_captured_emails',
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
