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