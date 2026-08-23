import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { requireAuth, generateId } from '../../_utils';
import type { Ctx } from '../../_utils';

// 设置密码（需登录态）
export const POST: FrameworkCallbackOptions['POST'] = async (context) => {
  const { request, env } = context;

  // 校验登录态
  const auth = await requireAuth(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: '请先登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { password } = body as { password: string };

  // 密码校验：至少6位，且同时包含数字和字母
  if (!password || typeof password !== 'string' || password.length < 6) {
    return new Response(JSON.stringify({ error: '密码长度至少6位' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return new Response(JSON.stringify({ error: '密码需同时包含字母和数字' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 使用 PBKDF2 安全哈希（Cloudflare Workers 原生支持 crypto.subtle）
  const salt = generateId();
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
  const passwordHash = btoa(String.fromCharCode(...hashBuf)) + ':' + salt;

  // 更新用户 password_hash
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
  ).bind(passwordHash, Date.now(), auth.userId).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
