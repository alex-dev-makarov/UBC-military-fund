CREATE TABLE report_views (
  id          INTEGER PRIMARY KEY,
  telegram_id INTEGER NOT NULL,
  viewed_at   INTEGER NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX idx_report_views_viewed_at ON report_views (viewed_at);
CREATE INDEX idx_report_views_telegram_id ON report_views (telegram_id);
