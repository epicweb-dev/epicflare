CREATE TABLE IF NOT EXISTS resend_captured_emails (
	id TEXT PRIMARY KEY,
	token_hash TEXT NOT NULL,
	received_at INTEGER NOT NULL,
	from_email TEXT NOT NULL,
	to_json TEXT NOT NULL,
	subject TEXT NOT NULL,
	html TEXT NOT NULL,
	payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resend_captured_emails_token_received_at
	ON resend_captured_emails(token_hash, received_at DESC);
