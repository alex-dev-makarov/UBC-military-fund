-- Drop oidc_states (orphaned by PR-33); remove write-only columns from nonces and handoff tokens
DROP TABLE oidc_states;
ALTER TABLE users DROP COLUMN login_count;
ALTER TABLE login_nonces DROP COLUMN created_at;
ALTER TABLE handoff_tokens DROP COLUMN created_at;
