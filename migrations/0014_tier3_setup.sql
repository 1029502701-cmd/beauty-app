-- 问卷维度选项配置表
CREATE TABLE IF NOT EXISTS questionnaire_options (
  dimension TEXT PRIMARY KEY,
  options TEXT NOT NULL,
  updated_at INTEGER
);

-- 预置4个维度的选项数据
INSERT OR IGNORE INTO questionnaire_options (dimension, options, updated_at) VALUES 
('makeupStyle', '["清透日常风","精致约会风","复古港风","欧美烟熏风","汉服古风","职场通勤风"]', strftime('%s','now')),
('scenario', '["日常通勤","约会聚会","拍照旅行","婚礼派对","职场面试"]', strftime('%s','now')),
('skillLevel', '["新手入门","有一定基础","熟练进阶"]', strftime('%s','now')),
('timeCost', '["5分钟极简","15分钟日常","30分钟以上精致"]', strftime('%s','now'));

-- reports_tier3 已在 0001_init.sql 中创建，含 content/quiz_answers/scenario/token_id 等字段，无需额外 ALTER
