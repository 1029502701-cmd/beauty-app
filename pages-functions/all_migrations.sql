-- 用户表（手机号为主账号，微信为绑定登录方式）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- uuid
  phone TEXT UNIQUE NOT NULL, -- 主账号标识
  wechat_openid TEXT UNIQUE, -- App专用openid（微信开放平台，非小程序openid）
  wechat_unionid TEXT, -- 预留，跨端(App/小程序)打通用
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 用户面部特征档案（不对用户展示，仅用于达人匹配算法）
-- 数据来源：第一层分析后台异步写入，原始照片当天24点(北京时间)删除
CREATE TABLE IF NOT EXISTS user_face_profile (
  user_id TEXT PRIMARY KEY,
  face_shape TEXT,
  features TEXT, -- JSON，结构化五官特征
  tags TEXT, -- JSON，供匹配算法使用的标签/向量
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 第二层报告（风格进阶）
CREATE TABLE IF NOT EXISTS reports_tier2 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL, -- JSON: 核心妆容/原因/风格/重点部位/公式/产品推荐
  ai_image_url TEXT, -- AI生成的上妆效果图，R2地址，当天24点删除
  unlock_method TEXT, -- 'ad' or 'code'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 第二层每日限流（每用户每天限生成1次AI效果图）
CREATE TABLE IF NOT EXISTS tier2_daily_usage (
  user_id TEXT NOT NULL,
  usage_date TEXT NOT NULL, -- YYYY-MM-DD，北京时间
  used_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- 第三层Token（一次性核销码，购买后使用）
CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unused', -- unused/used
  user_id TEXT, -- 核销后绑定（点击"生成报告"那一刻核销，而非输入token时）
  price INTEGER, -- 购买时实际价格，单位:分，当前固定600(6元)，为未来调价留存历史
  order_id TEXT, -- 关联订单
  created_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 第三层报告（专属美学，30天后物理删除，Cron清理）
CREATE TABLE IF NOT EXISTS reports_tier3 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_id TEXT NOT NULL,
  scenario TEXT NOT NULL, -- 日常/正式/约会 等
  quiz_answers TEXT NOT NULL, -- JSON
  content TEXT NOT NULL, -- JSON
  created_at INTEGER NOT NULL,
  expire_at INTEGER NOT NULL, -- created_at + 30天，北京时间口径
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (token_id) REFERENCES tokens(id)
);

-- 订单表（微信支付/支付宝 H5）
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL, -- 单位:分
  channel TEXT NOT NULL, -- 'wechat' or 'alipay'
  status TEXT NOT NULL DEFAULT 'pending', -- pending/paid/failed/closed
  token_id TEXT, -- 支付成功后生成的token id
  out_trade_no TEXT UNIQUE NOT NULL, -- 商户订单号
  transaction_id TEXT, -- 第三方支付流水号
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 达人入驻表
CREATE TABLE IF NOT EXISTS influencers (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  bio TEXT,
  makeup_photo_url TEXT NOT NULL, -- 妆容照，长期保留展示用
  platform TEXT,
  link1 TEXT,
  link2 TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected，人工审核
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 达人面部特征档案（素颜照分析后原图立即删除，仅留结构化数据，逻辑与user_face_profile对称）
CREATE TABLE IF NOT EXISTS influencer_face_profile (
  influencer_id TEXT PRIMARY KEY,
  face_shape TEXT,
  features TEXT, -- JSON
  tags TEXT, -- JSON
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (influencer_id) REFERENCES influencers(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_reports_tier2_user ON reports_tier2(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_tier3_user ON reports_tier3(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_tier3_expire ON reports_tier3(expire_at);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_influencers_status ON influencers(status);
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
-- 第一层报告（基础面部分析结果）
CREATE TABLE IF NOT EXISTS reports_tier1 (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  report_data TEXT NOT NULL, -- JSON: faceShape/skinType/.../highlight/suggestions 整份结果
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_reports_tier1_user ON reports_tier1(user_id);
-- 给 reports_tier2 补充来源 tier1 报告关联、分享 token 及生成状态字段
ALTER TABLE reports_tier2 ADD COLUMN source_tier1_report_id TEXT;
ALTER TABLE reports_tier2 ADD COLUMN share_token TEXT;
ALTER TABLE reports_tier2 ADD COLUMN generation_status TEXT DEFAULT 'pending';


-- 给 reports_tier2 补充 scenario 字段（用于前端展示报告场景标签）
ALTER TABLE reports_tier2 ADD COLUMN scenario TEXT;
-- 给 reports_tier2 补充 updated_at 列，用于记录 AI 内容/图片的更新时间
ALTER TABLE reports_tier2 ADD COLUMN updated_at INTEGER;

ALTER TABLE users ADD COLUMN password_hash TEXT;

-- 为 orders 表增加 purpose 字段，区分 token 购买和达人入驻费
ALTER TABLE orders ADD COLUMN purpose TEXT DEFAULT 'token_purchase';

-- 为 influencers 表增加 order_id 字段，关联入驻费订单
ALTER TABLE influencers ADD COLUMN order_id TEXT;

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
-- 为 influencers 表增加 user_id 字段，关联申请人用户
ALTER TABLE influencers ADD COLUMN user_id TEXT;
-- 功能需求反馈入口配置项
INSERT OR IGNORE INTO app_config (key, value, updated_at)
VALUES
  ('feature_request_message', '有什么需要的功能欢迎投稿～', strftime('%s','now')),
  ('feature_request_contact', '', strftime('%s','now'));


-- 为 influencers 表增加 reject_reason 字段，记录拒绝原因
ALTER TABLE influencers ADD COLUMN reject_reason TEXT;

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

-- 0016: 将联系方式配置从纯字符串迁移为 JSON 格式 {platform, account}
-- 影响项：influencer_contact_info、feature_request_contact
-- 空字符串 → 默认微信平台空账号；非空字符串 → 其他平台，原有内容作为账号

UPDATE app_config
SET value = json_object('platform', '微信', 'account', ''),
    updated_at = strftime('%s', 'now')
WHERE key IN ('influencer_contact_info', 'feature_request_contact')
  AND (value = '' OR value IS NULL);

UPDATE app_config
SET value = json_object('platform', '其他', 'account', value),
    updated_at = strftime('%s', 'now')
WHERE key IN ('influencer_contact_info', 'feature_request_contact')
  AND value != '' AND value IS NOT NULL;

-- 0017: 联系方式配置从单个对象改为数组格式 [{platform, account}]
-- 影响项：influencer_contact_info、feature_request_contact
-- 空值 → 空数组[]；已有单对象 → 包装成[对象]；已是数组 → 不变

UPDATE app_config
SET value = '[]',
    updated_at = strftime('%s', 'now')
WHERE key IN ('influencer_contact_info', 'feature_request_contact')
  AND (value = '' OR value IS NULL);

UPDATE app_config
SET value = '[' || value || ']',
    updated_at = strftime('%s', 'now')
WHERE key IN ('influencer_contact_info', 'feature_request_contact')
  AND value != '' AND value IS NOT NULL
  AND json_valid(value) = 1
  AND json_type(value) != 'array';

-- Add styles column to influencers table
ALTER TABLE influencers ADD COLUMN styles TEXT;

-- Add email column to users table for email-based registration
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
-- 0019: Allow email-only registrations by making phone nullable concept
-- phone remains NOT NULL in schema; email-only accounts use a generated placeholder (gen_<uuid>)
-- This migration is informational — no DDL change needed for app-layer logic
CREATE TABLE users_new (
  id TEXT PRIMARY KEY,
  phone TEXT,
  email TEXT,
  wechat_openid TEXT UNIQUE,
  wechat_unionid TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  password_hash TEXT
);
INSERT INTO users_new SELECT id, phone, email, wechat_openid, wechat_unionid, created_at, updated_at, password_hash FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE UNIQUE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES ('t1-001', 'd9cb216b-cee1-4235-9e29-5ed9b2c8758a', '{"faceShape":"方脸","skinType":"干性肌","eyebrowShape":"平眉","eyeShape":"丹凤眼","threeFiveRatio":"上庭偏长","symmetry":"中等对称度","personaTags":["成熟干练","气场强","中性风"],"highlight":"下颌线清晰有棱角，颧骨略高，整体轮廓偏硬朗","suggestions":["柔和眉形可弱化方脸的硬朗感","干皮需加强保湿底妆避免卡粉","丹凤眼适合猫眼线加大地色消肿","上庭长可用刘海或侧分修饰","用暖色调腮红中和冷硬感"],"facePhotoKey":"face-photos/t1-001.jpg"}', 1787749000);
INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES ('t1-002', '68cf87db-96a1-44fe-ad28-c71db789acb8', '{"faceShape":"心形脸","skinType":"敏感肌","eyebrowShape":"拱形眉","eyeShape":"圆眼","threeFiveRatio":"中庭偏短","symmetry":"高对称度","personaTags":["甜美可爱","少女感","清新自然"],"highlight":"额头较宽下巴尖，苹果肌饱满，眼神清澈","suggestions":["低拱眉更配心形脸的柔和感","敏感肌优先用矿物彩妆避开酒精香精","圆眼适合下垂眼线打造无辜感","中庭短可用横向腮红拉长视觉","轻透底妆保留皮肤原生质感"],"facePhotoKey":"face-photos/t1-002.jpg"}', 1787749001);
INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES ('t1-003', 'cc37e1ff-143d-467e-a894-90fb5f93daec', '{"faceShape":"菱形脸","skinType":"混干肌","eyebrowShape":"挑眉","eyeShape":"桃花眼","threeFiveRatio":"下庭偏短","symmetry":"低对称度","personaTags":["个性时尚","锐利感","冷艳"],"highlight":"颧骨是面部最宽处太阳穴凹陷明显鼻梁高但下庭偏短","suggestions":["太阳穴填充式修容是关键","挑眉可拉长脸部比例","桃花眼适合微烟熏加睫毛重点","低对称度用遮瑕修正不对称眉毛画法","下庭短可用纵向腮红延伸视觉"],"facePhotoKey":"face-photos/t1-003.jpg"}', 1787749002);
INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES ('t1-004', 'b3f91dbc-c7a4-4f9d-9976-39cee70b283a', '{"faceShape":"鹅蛋脸","skinType":"油性肌","eyebrowShape":"标准眉","eyeShape":"杏眼","threeFiveRatio":"三庭均衡","symmetry":"高对称度","personaTags":["百搭不出错","气质均衡","经典美"],"highlight":"面部比例最接近黄金分割几乎没有需要特殊修饰的问题","suggestions":["油性肌重点在控油持妆","标准眉加杏眼几乎百搭任何风格","选择哑光底妆防止脱妆","可以大胆尝试各种妆容风格"],"facePhotoKey":"face-photos/t1-004.jpg"}', 1787749003);
INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES ('t1-005', 'bdb57c5a-06ea-482a-bf87-9d16fdc4f973', '{"faceShape":"长脸","skinType":"中性肌","eyebrowShape":"一字眉","eyeShape":"小鹿眼","threeFiveRatio":"中庭偏长","symmetry":"中等对称度","personaTags":["清冷系","文艺感","盐系"],"附加":["发际线偏高","鼻梁挺直","嘴唇偏薄","耳位略低","肩颈比例优秀"],"highlight":"脸型偏长中庭占比大五官量感偏小气质清冷","suggestions":["一字眉加横向腮红缩短中庭视觉","小鹿眼适合裸妆感强调睫毛而非眼线","发际线高可用碎发或发粉修饰","唇妆用略带光泽感的颜色增加量感","整体走清冷盐系路线色彩不宜过重"],"facePhotoKey":"face-photos/t1-005.jpg"}', 1787749004);

INSERT INTO reports_tier2 (id, user_id, content, generation_status, source_tier1_report_id, created_at) VALUES ('tier2-test-a', 'd9cb216b-cee1-4235-9e29-5ed9b2c8758a', '{}', 'pending', 't1-001', 1787749000);
INSERT INTO reports_tier2 (id, user_id, content, generation_status, source_tier1_report_id, created_at) VALUES ('tier2-test-b', '68cf87db-96a1-44fe-ad28-c71db789acb8', '{}', 'pending', 't1-002', 1787749001);
INSERT INTO reports_tier2 (id, user_id, content, generation_status, source_tier1_report_id, created_at) VALUES ('tier2-test-c', 'cc37e1ff-143d-467e-a894-90fb5f93daec', '{}', 'pending', 't1-003', 1787749002);
INSERT INTO reports_tier2 (id, user_id, content, generation_status, source_tier1_report_id, created_at) VALUES ('tier2-test-d', 'b3f91dbc-c7a4-4f9d-9976-39cee70b283a', '{}', 'pending', 't1-004', 1787749003);
INSERT INTO reports_tier2 (id, user_id, content, generation_status, source_tier1_report_id, created_at) VALUES ('tier2-test-e', 'bdb57c5a-06ea-482a-bf87-9d16fdc4f973', '{}', 'pending', 't1-005', 1787749004);

