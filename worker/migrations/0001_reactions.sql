CREATE TABLE IF NOT EXISTS reactions (
  article_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (article_id, voter_id)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS reactions_created_at_idx ON reactions (created_at);
