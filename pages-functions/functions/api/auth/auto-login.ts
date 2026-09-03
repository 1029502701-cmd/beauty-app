import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { generateId } from '../../_utils';

export const GET: FrameworkCallbackOptions['GET'] = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const account = url.searchParams.get('account');
  if (!account || typeof account !== 'string') {
    return new Response(JSON.stringify({ error: '请输入账号' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const isEmail = account.includes('@');
  if (isEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) return new Response(JSON.stringify({ error: '请输入正确的邮箱地址' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } else {
    if (!/^1[3-9]\d{9}$/.test(account)) return new Response(JSON.stringify({ error: '请输入正确的手机号' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const nowMs = Date.now();
  const now = Math.floor(Date.now() / 1000);
  const user = isEmail
    ? await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ? LIMIT 1').bind(account).first<any>()
    : await env.DB.prepare('SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1').bind(account).first<any>();
  let userId: string;
  let isNew: boolean;
  let needPassword: boolean = false;

  if (!user) {
    // 新账号：自动注册，不需要密码
    userId = generateId();
    const phone = isEmail ? 'gen_' + userId : account;
    const email = isEmail ? account : null;
    await env.DB.prepare('INSERT INTO users (id, phone, email, created_at, updated_at, password_hash) VALUES (?, ?, ?, ?, ?, NULL)').bind(userId, phone, email, nowMs, nowMs).run();
    isNew = true;
  } else {
    userId = user.id;
    isNew = false;
    needPassword = !!user.password_hash;
  }

  // 老账号且有密码：验证密码（PBKDF2，与 register.ts/login.ts 同一套实现）
  if (!isNew && user?.password_hash) {
    const providedPassword = url.searchParams.get('password');
    if (!providedPassword) {
      return new Response(JSON.stringify({ needPassword: true, isNew: false, message: '请输入密码' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const [storedHash, salt] = (user.password_hash as string).split(':');
    if (!storedHash || !salt) {
      return new Response(JSON.stringify({ error: '账号或密码错误' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(providedPassword), 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
    const hashBuf = new Uint8Array(derivedBits);
    const inputHash = btoa(String.fromCharCode(...hashBuf));
    if (inputHash !== storedHash) {
      return new Response(JSON.stringify({ error: '账号或密码错误', needPassword: true, isNew: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const sessionId = generateId();
  await env.SESSION_KV.put('session:' + sessionId, JSON.stringify({ userId, gender: url.searchParams.get("gender"), age_range: url.searchParams.get("age_range"), expiresAt: now + 7 * 24 * 60 * 60 }), { expirationTtl: 7 * 24 * 60 * 60 });
  return new Response(JSON.stringify({ sessionId, isNew, needPassword }), { headers: { 'Content-Type': 'application/json' } });
};
export const onRequestGet = async (...args) => GET(args[0]);
