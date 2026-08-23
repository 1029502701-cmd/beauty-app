-- 给 reports_tier2 补充来源 tier1 报告关联、分享 token 及生成状态字段
ALTER TABLE reports_tier2 ADD COLUMN source_tier1_report_id TEXT;
ALTER TABLE reports_tier2 ADD COLUMN share_token TEXT;
ALTER TABLE reports_tier2 ADD COLUMN generation_status TEXT DEFAULT 'pending';

