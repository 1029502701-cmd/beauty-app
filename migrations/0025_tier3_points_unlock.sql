-- 积分解锁专属（tier3）报告的"已解锁资格"记录（本端落库，保证刷新/换设备不丢）。
-- 设计：扣积分发生在"解锁"那一刻（auth-center /api/points/consume，once 去重，一人一次）；
-- 本表记录该用户已积分解锁过，作为"资格"的持久化来源。
--  - key = user_id（专属报告每人一次，一人一行即可）
--  - source='points' 表示该资格来自积分解锁
CREATE TABLE IF NOT EXISTS tier3_points_unlock (
  user_id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'points',
  report_ref TEXT,
  unlocked_at INTEGER NOT NULL
);
