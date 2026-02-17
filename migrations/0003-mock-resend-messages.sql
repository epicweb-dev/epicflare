CREATE TABLE IF NOT EXISTS mock_resend_messages (
	id TEXT PRIMARY KEY,
	token_hash TEXT NOT NULL,
	received_at INTEGER NOT NULL,
	from_email TEXT NOT NULL,
	to_json TEXT NOT NULL,
	subject TEXT NOT NULL,
	html TEXT NOT NULL,
	payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS mock_resend_messages_token_received_at
	ON mock_resend_messages(token_hash, received_at DESC);

