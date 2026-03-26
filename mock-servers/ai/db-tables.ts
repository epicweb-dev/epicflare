import { column, table } from 'remix/data-table'

export const aiCapturedRequestsTable = table({
	name: 'ai_captured_requests',
	columns: {
		id: column.text(),
		token_hash: column.text(),
		received_at: column.integer(),
		scenario: column.text(),
		last_user_message: column.text(),
		tool_names_json: column.text(),
		request_json: column.text(),
		response_text: column.text(),
	},
	primaryKey: 'id',
})
