-- 为 influencers 表增加 order_id 字段，关联入驻费订单
ALTER TABLE influencers ADD COLUMN order_id TEXT;
