import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import type { Ctx } from '../_utils';

// GET /api/config/:key  — 公开接口，无需登录
export const GET: FrameworkCallbackOptions['GET'] = async (context) => {
  const { env, params } = context;
  const key = params?.key as string;

  if (!key) {
    return new Response(JSON.stringify({ error: '缺少 key 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 确保表存在（本地开发容错）
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER
    )
  `).run();

  // 初始化默认数据
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('influencer_apply_message', '申请已提交，我们会尽快联系你～', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('influencer_contact_info', '', ?)`
  ).bind(now).run();

  const row = await env.DB.prepare(
    'SELECT key, value, updated_at FROM app_config WHERE key = ? LIMIT 1'
  ).bind(key).first<any>();

  if (!row) {
    return new Response(JSON.stringify({ error: '配置项不存在' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ key: row.key, value: row.value, updated_at: row.updated_at }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};