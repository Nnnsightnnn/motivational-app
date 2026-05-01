-- Steady — initial schema
-- D1 (SQLite). JSON columns stored as TEXT; query with json_extract() when needed.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  settings    TEXT  -- JSON: timezone, theme, default toggles, etc.
);

CREATE TABLE IF NOT EXISTS check_ins (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  state       TEXT NOT NULL,  -- JSON: {mood:[], energy:'low'|'mid'|'high', need:[], free_text?}
  context     TEXT,            -- JSON: {time_of_day, inferred_tags:[...]}
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS content_items (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,         -- 'quote' | 'grounding' | 'breath' | 'reframe' | 'action'
  source_type   TEXT NOT NULL,         -- 'curated' | 'generated'
  text          TEXT NOT NULL,
  attribution   TEXT,
  duration_sec  INTEGER,
  tags          TEXT NOT NULL,         -- JSON array of tag strings
  created_at    INTEGER NOT NULL,
  archived      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  check_in_id   TEXT NOT NULL,
  content_ids   TEXT NOT NULL,         -- JSON array of content_items.id
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER,
  FOREIGN KEY (check_in_id) REFERENCES check_ins(id)
);

CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  content_id  TEXT NOT NULL,
  rating      TEXT NOT NULL,           -- 'helped' | 'neutral' | 'missed'
  note        TEXT,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (content_id) REFERENCES content_items(id)
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_time   ON check_ins(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_content     ON feedback(content_id, rating);
CREATE INDEX IF NOT EXISTS idx_content_type_arch    ON content_items(type, archived);
CREATE INDEX IF NOT EXISTS idx_sessions_checkin     ON sessions(check_in_id);
