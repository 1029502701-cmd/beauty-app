import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { requireAdminAuth } from '../../_utils';
import type { Ctx } from '../../_utils';

// GET /api/admin/config — 读取所有配置项（公开接口，供前端读取）
export const GET: FrameworkCallbackOptions['GET'] = async (context) => {
  const { request, env } = context;

  // 确保表存在
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER
    )
  `).run();

  const now = Math.floor(Date.now() / 1000);
  // 原有配置
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('influencer_apply_message', '申请已提交，我们会尽快联系你～', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('influencer_contact_info', '', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('sms_login_enabled', 'false', ?)`
  ).bind(now).run();
  // Tier2 新配置
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('tier2_show_ai_image', 'true', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('tier2_btn_color', '#E91E63', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('tier2_hook_text', '解锁专属报告，搭配更多场景', ?)`
  ).bind(now).run();

  const rows = await env.DB.prepare(
    'SELECT key, value, updated_at FROM app_config ORDER BY key'
  ).all<any>();

  return new Response(JSON.stringify({ configs: rows.results ?? [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// POST /api/admin/config — 更新或新增配置项（需管理员认证）
export const POST: FrameworkCallbackOptions['POST'] = async (context) => {
  const { request, env } = context;

  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: '无权限' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { key, value } = body as { key: string; value: string };

  if (!key || value === undefined) {
    return new Response(JSON.stringify({ error: '缺少 key 或 value' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(key, value, now).run();

  return new Response(JSON.stringify({ success: true, key, value }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
