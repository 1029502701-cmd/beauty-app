-- 给 reports_tier2 补充 updated_at 列，用于记录 AI 内容/图片的更新时间
ALTER TABLE reports_tier2 ADD COLUMN updated_at INTEGER;
