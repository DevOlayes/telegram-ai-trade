-- Cloudflare D1 schema reconstructed from the repository's generated Supabase types.
-- JSON-valued columns are stored as JSON text. This migration creates schema only;
-- it does not import user records or change application behavior.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  telegram_id INTEGER NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT,
  referral_source TEXT,
  bonus_amount REAL NOT NULL DEFAULT 0,
  bonus_claimed INTEGER NOT NULL DEFAULT 0,
  bonus_claimed_at TEXT,
  bonus_expired_at TEXT,
  bonus_expires_at TEXT,
  bonus_used INTEGER NOT NULL DEFAULT 0,
  bonus_used_at TEXT,
  promo_earnings REAL NOT NULL DEFAULT 0,
  risk_flags TEXT NOT NULL DEFAULT '[]',
  risk_score REAL NOT NULL DEFAULT 0,
  flagged_reason TEXT,
  trade_unlock_until TEXT,
  share_platforms TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  screen_message_id INTEGER,
  ui_state TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (referred_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS balances (
  user_id TEXT PRIMARY KEY,
  balance REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  locked REAL NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  referral_balance REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  ref_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount REAL NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  entry_price REAL NOT NULL,
  current_price REAL NOT NULL,
  take_profit REAL NOT NULL,
  stop_loss REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  potential_profit REAL NOT NULL,
  potential_loss REAL NOT NULL,
  leverage REAL NOT NULL DEFAULT 1,
  risk_profile TEXT NOT NULL DEFAULT 'balanced',
  target_outcome TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  result TEXT,
  pnl REAL,
  opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  settled_at TEXT,
  last_update_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  message_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trading_pairs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  symbol TEXT NOT NULL UNIQUE,
  base_price REAL NOT NULL,
  volatility REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  unique_amount REAL NOT NULL,
  wallet_address TEXT NOT NULL,
  tx_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  message_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  credited_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,
  wallet_address TEXT NOT NULL,
  network TEXT NOT NULL DEFAULT 'TRC20',
  status TEXT NOT NULL DEFAULT 'pending',
  service_fee_amount REAL NOT NULL DEFAULT 4,
  service_fee_status TEXT NOT NULL DEFAULT 'pending',
  service_fee_tx TEXT UNIQUE,
  fee_requested_at TEXT,
  admin_note TEXT,
  message_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  referrer_id TEXT NOT NULL,
  referred_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  reward_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  qualified_at TEXT,
  FOREIGN KEY (referrer_id) REFERENCES users(id),
  FOREIGN KEY (referred_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  user_id TEXT NOT NULL,
  referral_id TEXT,
  kind TEXT NOT NULL DEFAULT 'referral',
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (referral_id) REFERENCES referrals(id)
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  active_referrals INTEGER NOT NULL,
  reward_amount REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS user_milestones (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  user_id TEXT NOT NULL,
  milestone_id TEXT NOT NULL,
  reached_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, milestone_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (milestone_id) REFERENCES milestones(id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  admin_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS broadcasts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  title TEXT,
  body TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'none',
  media_url TEXT,
  buttons TEXT NOT NULL DEFAULT '[]',
  audience TEXT NOT NULL,
  audience_params TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  total_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  started_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))),
  broadcast_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  telegram_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TEXT,
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_trades_user_created ON trades(user_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status_expires ON trades(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_user_status ON deposits(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deposits_status_created ON deposits(status, created_at);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_created ON withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_fee_status ON withdrawals(service_fee_status);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status ON referrals(referrer_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_created ON referral_rewards(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_created ON events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast_status ON broadcast_recipients(broadcast_id, status);
