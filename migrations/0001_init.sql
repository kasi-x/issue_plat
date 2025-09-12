-- D1 schema for posts, annotations, reports, settings

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  html TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  content_hash TEXT,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  display_name TEXT,
  body_html TEXT NOT NULL,
  selectors TEXT NOT NULL,
  quote TEXT NOT NULL,
  parent_id INTEGER REFERENCES annotations(id),
  created_at TEXT DEFAULT (datetime('now')),
  state TEXT NOT NULL DEFAULT 'published',
  visitor_id TEXT,
  ip_hash TEXT,
  signals TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annotation_id INTEGER NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_annotations_post_id ON annotations(post_id);
CREATE INDEX IF NOT EXISTS idx_annotations_state ON annotations(state);
CREATE INDEX IF NOT EXISTS idx_annotations_quote ON annotations(quote);
