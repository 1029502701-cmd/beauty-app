-- 为 influencers 表增加 user_id 字段，关联申请人用户
ALTER TABLE influencers ADD COLUMN user_id TEXT;