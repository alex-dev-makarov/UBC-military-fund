CREATE TABLE security_events (
  id        INTEGER PRIMARY KEY,
  ts        INTEGER NOT NULL,
  event     TEXT    NOT NULL,
  data      TEXT    NOT NULL
);
CREATE INDEX idx_security_events_ts ON security_events (ts);

CREATE TRIGGER security_events_no_update BEFORE UPDATE ON security_events
BEGIN
  SELECT RAISE(ABORT, 'security_events is append-only');
END;

CREATE TRIGGER security_events_keep_recent BEFORE DELETE ON security_events
WHEN OLD.ts > CAST(strftime('%s', 'now') AS INTEGER) * 1000 - 30 * 86400000
BEGIN
  SELECT RAISE(ABORT, 'security_events younger than 30 days cannot be deleted');
END;

CREATE TRIGGER report_views_no_update BEFORE UPDATE ON report_views
BEGIN
  SELECT RAISE(ABORT, 'report_views is append-only');
END;

CREATE TRIGGER report_views_keep_recent BEFORE DELETE ON report_views
WHEN OLD.viewed_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000 - 30 * 86400000
BEGIN
  SELECT RAISE(ABORT, 'report_views younger than 30 days cannot be deleted');
END;

UPDATE users
   SET sessions_valid_after = sessions_valid_after * 1000
 WHERE sessions_valid_after > 0 AND sessions_valid_after < 100000000000;
