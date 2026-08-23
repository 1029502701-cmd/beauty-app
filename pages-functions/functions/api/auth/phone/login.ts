import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { requireAuth, beijingDate, generateId } from '../../_utils';
import type { Ctx } from '../../_utils';

// 手机号验证码登录/注册
export const POST: FrameworkCallbackOptions['POST'] = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { phone, code } = body as { phone: string; code: string };

  // 1. 验证验证码（检查 KV 中的验证码是否匹配且未过期）
  const stored = await env.SESSION_KV.get('sms_code:' + phone);
  if (!stored) {
    return new Response(JSON.stringify({ error: '验证码已过期，请重新获取' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { code: expectedCode, expiresAt } = JSON.parse(stored);
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt < now) {
    return new Response(JSON.stringify({ error: '验证码已过期，请重新获取' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (expectedCode !== code) {
    return new Response(JSON.stringify({ error: '验证码错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. 按手机号查询或创建用户（先查后插，避免每次生成新 UUID 导致 session 不一致）
  const nowMs = Date.now();
  const existing = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1'
  ).bind(phone).first();

  const userId = existing?.id ?? generateId();
  if (!existing) {
    await env.DB.prepare(
      'INSERT INTO users (id, phone, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(userId, phone, nowMs, nowMs).run();
  } else {
    // 更新 updated_at
    await env.DB.prepare(
      'UPDATE users SET updated_at = ? WHERE id = ?'
    ).bind(nowMs, userId).run();
  }

  // 3. 生成 session，写入 KV（7天过期）
  const sessionId = generateId();
  await env.SESSION_KV.put(
    'session:' + sessionId,
    JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60 }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );

  // 4. 清除已使用的验证码
  await env.SESSION_KV.delete('sms_code:' + phone);

  // 5. 返回 hasPassword 字段，供前端判断是否强制跳转设置密码
  const hasPassword = !!existing?.password_hash;

  return new Response(JSON.stringify({ sessionId, hasPassword }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
