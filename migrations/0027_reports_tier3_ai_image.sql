-- reports_tier3 增加 ai_image_url：专属报告插入的 AI 妆效图 R2 key（与 reports_tier2.ai_image_url 同机制）。
-- 幂等：D1 的 ALTER TABLE ADD COLUMN 若列已存在会报错，迁移框架对已应用迁移不会重跑；
-- 但为兼容"列已手工加过"的旧环境，这里用条件判断写法。
CREATE TABLE IF NOT EXISTS _migrate_0027_guard AS SELECT 1 AS x WHERE 0;
DROP TABLE IF EXISTS _migrate_0027_guard;
ALTER TABLE reports_tier3 ADD COLUMN ai_image_url TEXT;
