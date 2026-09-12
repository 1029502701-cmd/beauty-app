-- 本端 user_id 与 中枢手机号 的映射表
-- 中枢按手机号记账；登录代理拿到中枢 JWT 后写入本表，
-- 供 resolveUserPhone 反查手机号（中枢签发的 JWT 不含 phone claim）。
CREATE TABLE IF NOT EXISTS user_phone_map (
  user_id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
