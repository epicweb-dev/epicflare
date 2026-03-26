import { column, table } from 'remix/data-table'

export const resendCapturedEmailsTable = table({
	name: 'resend_captured_emails',
	columns: {
		id: column.text(),
		token_hash: column.text(),
		received_at: column.integer(),
		from_email: column.text(),
		to_json: column.text(),
		subject: column.text(),
		html: column.text(),
		payload_json: column.text(),
	},
	primaryKey: 'id',
})
