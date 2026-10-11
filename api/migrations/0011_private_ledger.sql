CREATE TABLE private_years (
  year          INTEGER PRIMARY KEY,
  summary_total REAL,
  has_receipt   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE private_expenses (
  id          INTEGER PRIMARY KEY,
  date        TEXT    NOT NULL,
  item        TEXT    NOT NULL,
  person      TEXT,
  note        TEXT,
  price       REAL    NOT NULL,
  delivery    REAL    NOT NULL DEFAULT 0,
  commission  REAL    NOT NULL DEFAULT 0,
  has_receipt INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_private_expenses_date ON private_expenses (date);

CREATE TABLE private_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
