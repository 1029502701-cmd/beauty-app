-- 0017: 联系方式配置从单个对象改为数组格式 [{platform, account}]
-- 影响项：influencer_contact_info、feature_request_contact
-- 空值 → 空数组[]；已有单对象 → 包装成[对象]；已是数组 → 不变

UPDATE app_config
SET value = '[]',
    updated_at = strftime('%s', 'now')
WHERE key IN ('influencer_contact_info', 'feature_request_contact')
  AND (value = '' OR value IS NULL);

UPDATE app_config
SET value = '[' || value || ']',
    updated_at = strftime('%s', 'now')
WHERE key IN ('influencer_contact_info', 'feature_request_contact')
  AND value != '' AND value IS NOT NULL
  AND json_valid(value) = 1
  AND json_type(value) != 'array';
