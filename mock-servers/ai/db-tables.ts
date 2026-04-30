import { column as c, table } from 'remix/data-table'

export const aiCapturedRequestsTable = table({
	name: 'ai_captured_requests',
	columns: {
		id: c.text(),
		token_hash: c.text(),
		received_at: c.integer(),
		scenario: c.text(),
		last_user_message: c.text(),
		tool_names_json: c.text(),
		request_json: c.text(),
		response_text: c.text(),
	},
	primaryKey: 'id',
})
