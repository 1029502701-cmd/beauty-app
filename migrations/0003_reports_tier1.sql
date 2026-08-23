-- 第一层报告（基础面部分析结果）
CREATE TABLE IF NOT EXISTS reports_tier1 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  report_data TEXT NOT NULL, -- JSON: faceShape/skinType/.../highlight/suggestions 整份结果
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_reports_tier1_user ON reports_tier1(user_id);