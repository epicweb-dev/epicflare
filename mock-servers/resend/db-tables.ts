import { column as c, table } from 'remix/data-table'

export const resendCapturedEmailsTable = table({
	name: 'resend_captured_emails',
	columns: {
		id: c.text(),
		token_hash: c.text(),
		received_at: c.integer(),
		from_email: c.text(),
		to_json: c.text(),
		subject: c.text(),
		html: c.text(),
		payload_json: c.text(),
	},
	primaryKey: 'id',
})
