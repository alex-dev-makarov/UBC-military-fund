CREATE TABLE users (
  telegram_id   INTEGER PRIMARY KEY,
  first_name    TEXT    NOT NULL,
  last_name     TEXT,
  username      TEXT,
  photo_url     TEXT,
  first_seen_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL,
  login_count   INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE used_hashes (
  hash       TEXT    PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_used_hashes_expires_at ON used_hashes (expires_at);
