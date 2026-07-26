CREATE TABLE IF NOT EXISTS garden_players (
  player_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  growth_ticks INTEGER NOT NULL DEFAULT 80 CHECK (growth_ticks >= 0),
  care_ticks INTEGER NOT NULL DEFAULT 0 CHECK (care_ticks >= 0),
  gloves_level INTEGER NOT NULL DEFAULT 0 CHECK (gloves_level >= 0),
  rain_barrel_level INTEGER NOT NULL DEFAULT 0 CHECK (rain_barrel_level >= 0),
  last_settled_at_ms INTEGER NOT NULL,
  passive_remainder_milliticks INTEGER NOT NULL DEFAULT 0
    CHECK (passive_remainder_milliticks >= 0 AND passive_remainder_milliticks < 1000),
  action_tokens_milli INTEGER NOT NULL DEFAULT 2000
    CHECK (action_tokens_milli >= 0 AND action_tokens_milli <= 2000),
  action_refill_at_ms INTEGER NOT NULL,
  certified_actions INTEGER NOT NULL DEFAULT 0 CHECK (certified_actions >= 0),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (session_version >= 1),
  recovery_code_hash TEXT NOT NULL UNIQUE,
  growth_reached_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS garden_players_ranking_idx
  ON garden_players (hidden, growth_ticks DESC, growth_reached_at_ms ASC, player_id ASC);

CREATE INDEX IF NOT EXISTS garden_players_updated_idx
  ON garden_players (updated_at_ms DESC);

CREATE TABLE IF NOT EXISTS garden_commands (
  player_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  command_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (player_id, command_id),
  FOREIGN KEY (player_id) REFERENCES garden_players (player_id) ON DELETE CASCADE
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS garden_commands_recent_idx
  ON garden_commands (player_id, created_at_ms DESC, command_id DESC);
