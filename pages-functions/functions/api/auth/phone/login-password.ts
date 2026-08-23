import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { generateId } from '../../_utils';
import type { Ctx } from '../../_utils';

// 手机号+密码登录
export const POST: FrameworkCallbackOptions['POST'] = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { phone, password } = body as { phone: string; password: string };

  // 查询用户
  const user = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1',
  ).bind(phone).first();

  if (!user) {
    return new Response(JSON.stringify({ error: '手机号或密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 检查是否已设置密码
  if (!user.password_hash) {
    return new Response(JSON.stringify({ error: '该账号尚未设置密码，请使用验证码登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 验证密码
  const [storedHash, salt] = (user.password_hash as string).split(':');
  if (!storedHash || !salt) {
    return new Response(JSON.stringify({ error: '手机号或密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const hashBuf = new Uint8Array(derivedBits);
  const inputHash = btoa(String.fromCharCode(...hashBuf));

  if (inputHash !== storedHash) {
    return new Response(JSON.stringify({ error: '手机号或密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 签发 session（与验证码登录一致的结构）
  const userId = user.id;
  const now = Math.floor(Date.now() / 1000);
  const sessionId = generateId();
  await env.SESSION_KV.put(
    'session:' + sessionId,
    JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60 }),
    { expirationTtl: 7 * 24 * 60 * 60 },
  );

  return new Response(JSON.stringify({ sessionId }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
