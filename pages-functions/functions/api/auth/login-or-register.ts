import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { generateId } from '../../_utils';
import type { Ctx } from '../../_utils';

// 账号+密码：合并登录/注册入口（支持手机号或邮箱）
export const POST: FrameworkCallbackOptions['POST'] = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { account, password, confirmPassword } = body as { account: string; password: string; confirmPassword: string };

  // 1. 参数校验
  if (!account || typeof account !== 'string') {
    return new Response(JSON.stringify({ error: '请输入账号' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const isEmail = account.includes('@');
  if (isEmail) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(account)) {
      return new Response(JSON.stringify({ error: '请输入正确的邮箱地址' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else {
    const phoneRe = /^1[3-9]\d{9}$/;
    if (!phoneRe.test(account)) {
      return new Response(JSON.stringify({ error: '请输入正确的手机号' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 2. 密码强度校验：至少6位，同时包含字母和数字
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

  // 3. 确认密码一致
  if (password !== confirmPassword) {
    return new Response(JSON.stringify({ error: '两次输入的密码不一致' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. 查询账号是否已存在
  const nowMs = Date.now();
  const user = isEmail
    ? await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ? LIMIT 1').bind(account).first<any>()
    : await env.DB.prepare('SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1').bind(account).first<any>();

  if (!user) {
    // ---- 新注册 ----
    const salt = generateId();
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256,
    );
    const hashBuf = new Uint8Array(derivedBits);
    const passwordHash = btoa(String.fromCharCode(...hashBuf)) + ':' + salt;

    const userId = generateId();
    const phone = isEmail ? 'gen_' + userId : account;
    const email = isEmail ? account : null;

    await env.DB.prepare(
      'INSERT INTO users (id, phone, email, created_at, updated_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(userId, phone, email, nowMs, nowMs, passwordHash).run();

    // 5. 签发 session（7天过期）
    const now = Math.floor(Date.now() / 1000);
    const sessionId = generateId();
    await env.SESSION_KV.put(
      'session:' + sessionId,
      JSON.stringify({ userId, gender: body.gender || null, age_range: body.age_range || null, expiresAt: now + 7 * 24 * 60 * 60 }),
      { expirationTtl: 7 * 24 * 60 * 60 },
    );

    return new Response(JSON.stringify({ sessionId, isNew: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ---- 已有账号：验证密码 ----
  if (!user.password_hash) {
    return new Response(JSON.stringify({ error: '该账号尚未设置密码，请使用验证码登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [storedHash, salt] = (user.password_hash as string).split(':');
  if (!storedHash || !salt) {
    return new Response(JSON.stringify({ error: '账号或密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256,
  );
  const hashBuf = new Uint8Array(derivedBits);
  const inputHash = btoa(String.fromCharCode(...hashBuf));

  if (inputHash !== storedHash) {
    // 密码不匹配：必须拒绝，不可放行
    return new Response(JSON.stringify({ error: '账号或密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 6. 密码匹配：签发 session（7天过期）
  const userId = user.id;
  const now = Math.floor(Date.now() / 1000);
  const sessionId = generateId();
  await env.SESSION_KV.put(
    'session:' + sessionId,
    JSON.stringify({ userId, gender: body.gender || null, age_range: body.age_range || null, expiresAt: now + 7 * 24 * 60 * 60 }),
    { expirationTtl: 7 * 24 * 60 * 60 },
  );

  return new Response(JSON.stringify({ sessionId, isNew: false }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
