ALTER TABLE private_expenses ADD COLUMN description TEXT;

CREATE TABLE private_expense_files (
  id         INTEGER PRIMARY KEY,
  expense_id INTEGER NOT NULL,
  kind       TEXT    NOT NULL CHECK (kind IN ('receipt', 'photo')),
  name       TEXT    NOT NULL,
  url        TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_private_expense_files_expense ON private_expense_files (expense_id);
