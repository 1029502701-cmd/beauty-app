-- 分享 referral 记录表
CREATE TABLE IF NOT EXISTS share_referrals (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  sharer_user_id TEXT NOT NULL,
  source_report_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  converted_user_id TEXT,
  converted_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_share_referrals_token ON share_referrals(token);
CREATE INDEX IF NOT EXISTS idx_share_referrals_sharer ON share_referrals(sharer_user_id, created_at);