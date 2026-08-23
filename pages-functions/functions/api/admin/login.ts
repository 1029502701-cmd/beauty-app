import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { verifyAdminCredentials, generateId } from '../../_utils';
import type { Ctx } from '../../_utils';

export const POST: FrameworkCallbackOptions['POST'] = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { username, password } = body as { username: string; password: string };

  const ok = await verifyAdminCredentials(username, password, env);
  if (!ok) {
    return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 签发独立的管理员 session（使用 admin_session: 前缀区分普通用户）
  const sessionId = generateId();
  const now = Math.floor(Date.now() / 1000);
  await env.SESSION_KV.put(
    'admin_session:' + sessionId,
    JSON.stringify({ expiresAt: now + 30 * 24 * 60 * 60 }),
    { expirationTtl: 30 * 24 * 60 * 60 }
  );

  return new Response(JSON.stringify({ sessionId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};