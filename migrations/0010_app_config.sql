-- 系统配置表（弹窗文案 + 联系方式等）
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER
);

-- 预置初始数据
INSERT OR IGNORE INTO app_config (key, value, updated_at)
VALUES
  ('influencer_apply_message', '申请已提交，我们会尽快联系你～', strftime('%s', 'now')),
  ('influencer_contact_info', '', strftime('%s', 'now'));