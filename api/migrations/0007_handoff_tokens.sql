CREATE TABLE handoff_tokens (
  token       TEXT    PRIMARY KEY,
  telegram_id INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX idx_handoff_tokens_expires_at ON handoff_tokens (expires_at);
