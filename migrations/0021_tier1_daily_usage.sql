-- Tier1 每日生成次数计数器（独立于 reports_tier1，与 tier1_daily_usage 一起配合实现"覆盖模式 + 每日上限"）
-- 结构对齐 tier2_daily_usage
CREATE TABLE IF NOT EXISTS tier1_daily_usage (
  user_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,  -- YYYY-MM-DD，北京时间
  used_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);
