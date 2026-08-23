-- 为 influencers 表增加 reject_reason 字段，记录拒绝原因
ALTER TABLE influencers ADD COLUMN reject_reason TEXT;
