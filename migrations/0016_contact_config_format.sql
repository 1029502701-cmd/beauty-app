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
