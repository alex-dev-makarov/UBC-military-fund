CREATE TABLE fund_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE fund_regions (
  id      INTEGER PRIMARY KEY,
  name_uk TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort    INTEGER NOT NULL
);
CREATE TABLE fund_categories (
  id      INTEGER PRIMARY KEY,
  name_uk TEXT NOT NULL,
  name_en TEXT NOT NULL,
  amount  REAL NOT NULL,
  color   TEXT NOT NULL,
  sort    INTEGER NOT NULL
);
CREATE TABLE fund_years (
  year   TEXT PRIMARY KEY,
  amount REAL NOT NULL
);
CREATE TABLE fund_months (
  month  INTEGER PRIMARY KEY,
  amount REAL NOT NULL
);
CREATE TABLE fund_recent (
  id       INTEGER PRIMARY KEY,
  date     TEXT NOT NULL,
  title_uk TEXT NOT NULL,
  title_en TEXT NOT NULL,
  amount   REAL NOT NULL,
  sort     INTEGER NOT NULL
);
