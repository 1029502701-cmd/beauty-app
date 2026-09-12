-- 积分解锁专属报告：应用层允许 reports_tier3.token_id 为 NULL（积分解锁的报告不关联 token）。
-- 0014_tier3_setup.sql 建的 reports_tier3.token_id 为 NOT NULL，积分路径需要插入 NULL，
-- 此处放宽该约束（新建一张可空 token_id 的 reports_tier3_0023，数据迁移后改名切换）。
CREATE TABLE IF NOT EXISTS reports_tier3_0023 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_id TEXT,
  scenario TEXT NOT NULL,
  quiz_answers TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expire_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (token_id) REFERENCES tokens(id)
);
INSERT INTO reports_tier3_0023 SELECT * FROM reports_tier3;
DROP TABLE reports_tier3;
ALTER TABLE reports_tier3_0023 RENAME TO reports_tier3;