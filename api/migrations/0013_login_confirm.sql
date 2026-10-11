ALTER TABLE login_nonces ADD COLUMN code INTEGER;
ALTER TABLE login_nonces ADD COLUMN choices TEXT;
ALTER TABLE login_nonces ADD COLUMN binding_hash TEXT;
ALTER TABLE login_nonces ADD COLUMN client TEXT;
ALTER TABLE users ADD COLUMN sessions_valid_after INTEGER NOT NULL DEFAULT 0;
