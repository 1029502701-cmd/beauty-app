-- tokens 表新增兑换码字段，支持购买后分享/转赠场景
ALTER TABLE tokens ADD COLUMN redeem_code TEXT;

-- 为现有未设置 redeem_code 的记录回填（兼容历史数据）
UPDATE tokens SET redeem_code = '' WHERE redeem_code IS NULL;

-- 创建唯一索引确保兑换码不重复
CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_redeem_code ON tokens(redeem_code);

-- 系统配置：第三层 token 价格（单位：分，当前默认 660 分 = 6.60 元）
INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES 
('tier3_token_price', '660', strftime('%s','now')),
('tier3_preview_text', '专属报告将为你提供：基于真实照片的深度分析、结合个人偏好的定制化妆容建议、分步骤实操指南...', strftime('%s','now'));
