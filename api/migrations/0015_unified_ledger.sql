-- One source of truth: the public report is now computed from private_expenses
-- (never reading person/note), so an expense is entered once and the public and
-- member-only reports cannot drift apart.

-- Public category (fund_categories.name_uk) and English title for the public site.
ALTER TABLE private_expenses ADD COLUMN category TEXT;
ALTER TABLE private_expenses ADD COLUMN item_en TEXT;

-- Per-category split of a year that only has a summary_total (e.g. 2025),
-- so the public category totals still cover it.
CREATE TABLE private_year_categories (
  year     INTEGER NOT NULL,
  category TEXT    NOT NULL,
  amount   REAL    NOT NULL,
  PRIMARY KEY (year, category)
);

DROP TABLE fund_years;
DROP TABLE fund_months;
DROP TABLE fund_recent;
ALTER TABLE fund_categories DROP COLUMN amount;
