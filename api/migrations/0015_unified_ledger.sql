ALTER TABLE private_expenses ADD COLUMN category TEXT;
ALTER TABLE private_expenses ADD COLUMN item_en TEXT;

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
