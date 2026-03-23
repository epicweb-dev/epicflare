import { createTable } from 'remix/data-table'
import { number, string } from 'remix/data-schema'

export const aiCapturedRequestsTable = createTable({
	name: 'ai_captured_requests',
	columns: {
		id: string(),
		token_hash: string(),
		received_at: number(),
		scenario: string(),
		last_user_message: string(),
		tool_names_json: string(),
		request_json: string(),
		response_text: string(),
	},
	primaryKey: 'id',
})
