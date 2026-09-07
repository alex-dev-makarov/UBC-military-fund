CREATE TABLE login_nonces (
  nonce       TEXT    PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  -- pending → the browser is waiting; authorized → member confirmed;
  -- denied → a real Telegram user who is not in the channel.
  status      TEXT    NOT NULL DEFAULT 'pending',
  telegram_id INTEGER,
  first_name  TEXT,
  last_name   TEXT,
  username    TEXT,
  photo_url   TEXT,
  consumed_at INTEGER
);
CREATE INDEX idx_login_nonces_expires_at ON login_nonces (expires_at);
