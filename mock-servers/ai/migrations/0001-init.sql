CREATE TABLE IF NOT EXISTS ai_captured_requests (
	id TEXT PRIMARY KEY,
	token_hash TEXT NOT NULL,
	received_at INTEGER NOT NULL,
	scenario TEXT NOT NULL,
	last_user_message TEXT NOT NULL,
	tool_names_json TEXT NOT NULL,
	request_json TEXT NOT NULL,
	response_text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_captured_requests_token_received_at
	ON ai_captured_requests(token_hash, received_at DESC);
