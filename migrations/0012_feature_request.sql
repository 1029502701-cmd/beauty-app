-- 功能需求反馈入口配置项
INSERT OR IGNORE INTO app_config (key, value, updated_at)
VALUES
  ('feature_request_message', '有什么需要的功能欢迎投稿～', strftime('%s','now')),
  ('feature_request_contact', '', strftime('%s','now'));

