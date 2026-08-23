-- 为 orders 表增加 purpose 字段，区分 token 购买和达人入驻费
ALTER TABLE orders ADD COLUMN purpose TEXT DEFAULT 'token_purchase';
