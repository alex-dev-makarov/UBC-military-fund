CREATE TABLE oidc_states (
  state         TEXT    PRIMARY KEY,
  code_verifier TEXT    NOT NULL,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  consumed_at   INTEGER
);
CREATE INDEX idx_oidc_states_expires_at ON oidc_states (expires_at);
