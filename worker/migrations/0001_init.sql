CREATE TABLE IF NOT EXISTS bounties (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  reward_minor TEXT NOT NULL,
  token TEXT NOT NULL,
  deadline INTEGER NOT NULL,
  status TEXT NOT NULL,
  poster TEXT NOT NULL,
  hunter TEXT,
  proof TEXT,
  tx_hash TEXT,
  created_at INTEGER NOT NULL,
  claimed_at INTEGER,
  submitted_at INTEGER,
  paid_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_bounties_status ON bounties(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bounties_poster ON bounties(poster);
CREATE INDEX IF NOT EXISTS idx_bounties_hunter ON bounties(hunter);
