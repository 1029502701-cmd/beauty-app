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
  if (!user) {
    userId = generateId();
    const phone = isEmail ? 'gen_' + userId : account;
    const email = isEmail ? account : null;
    await env.DB.prepare('INSERT INTO users (id, phone, email, created_at, updated_at, password_hash) VALUES (?, ?, ?, ?, ?, NULL)').bind(userId, phone, email, nowMs, nowMs).run();
    isNew = true;
  } else {
    userId = user.id;
    isNew = false;
  }
  const sessionId = generateId();
  await env.SESSION_KV.put('session:' + sessionId, JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60 }), { expirationTtl: 7 * 24 * 60 * 60 });
  return new Response(JSON.stringify({ sessionId, isNew }), { headers: { 'Content-Type': 'application/json' } });
};
export const onRequestGet = async (...args) => GET(args[0]);
