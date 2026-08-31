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
