ALTER TABLE login_nonces ADD COLUMN origin TEXT;
ALTER TABLE handoff_tokens ADD COLUMN origin TEXT;
