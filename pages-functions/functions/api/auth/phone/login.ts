import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import type { Ctx } from "../../_utils";

// 手机号验证码登录/注册
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { phone, code } = body as { phone: string; code: string };

  // 1. 检查尝试次数
  const attemptKey = `sms_attempts:${phone}`;
  const attemptStr = await env.SESSION_KV.get(attemptKey);
  if (attemptStr) {
    const { count, lockedUntil } = JSON.parse(attemptStr);
    const now = Math.floor(Date.now() / 1000);
    if (lockedUntil && lockedUntil > now) {
      const remaining = Math.ceil((lockedUntil - now) / 60);
      return new Response(JSON.stringify({ error: `验证码错误次数过多，请 ${remaining} 分钟后重试` }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // 2. 验证哈希验证码
  const stored = await env.SESSION_KV.get("sms_code:" + phone);
  if (!stored) { await incrementAttempts(phone, env); return new Response(JSON.stringify({ error: "验证码已过期，请重新获取" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
  const { codeHash, expiresAt } = JSON.parse(stored);
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt < now) { await incrementAttempts(phone, env); return new Response(JSON.stringify({ error: "验证码已过期，请重新获取" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
  const valid = await verifyCodeHash(code, phone, codeHash);
  if (!valid) { await incrementAttempts(phone, env); return new Response(JSON.stringify({ error: "验证码错误" }), { status: 400, headers: { "Content-Type": "application/json" } }); }

  // 3. 查询或创建用户
  const nowMs = Date.now();
  const existing = await env.DB.prepare("SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1").bind(phone).first();
  const userId = existing?.id ?? generateId();
  if (!existing) {
    await env.DB.prepare("INSERT INTO users (id, phone, created_at, updated_at) VALUES (?, ?, ?, ?)").bind(userId, phone, nowMs, nowMs).run();
  } else {
    await env.DB.prepare("UPDATE users SET updated_at = ? WHERE id = ?").bind(nowMs, userId).run();
  }

  // 4. 签发 session
  const sessionId = generateId();
  const inviteCode = (body as any).inviteCode || null;
  await env.SESSION_KV.put("session:" + sessionId, JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60, invite_code: inviteCode }), { expirationTtl: 7 * 24 * 60 * 60 });

  // 5. 清除验证码和尝试计数
  await env.SESSION_KV.delete("sms_code:" + phone);
  await env.SESSION_KV.delete(attemptKey);

  // 6. 返回 hasPassword
  const hasPassword = !!existing?.password_hash;
  return new Response(JSON.stringify({ sessionId, hasPassword }), { headers: { "Content-Type": "application/json" } });
};

async function incrementAttempts(phone: string, env: Ctx["env"]) {
  const key = `sms_attempts:${phone}`;
  const stored = await env.SESSION_KV.get(key);
  const now = Math.floor(Date.now() / 1000);
  if (!stored) { await env.SESSION_KV.put(key, JSON.stringify({ count: 1 }), { expirationTtl: 300 }); return; }
  const { count } = JSON.parse(stored);
  const newCount = count + 1;
  const lockUntil = newCount >= 5 ? now + 60 : null;
  await env.SESSION_KV.put(key, JSON.stringify({ count: newCount, lockedUntil: lockUntil }), { expirationTtl: 300 });
}

async function verifyCodeHash(inputCode: string, phone: string, storedHash: string): Promise<boolean> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(inputCode), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", keyMaterial, enc.encode(phone));
  return btoa(String.fromCharCode(...new Uint8Array(sig))) === storedHash;
}

export const onRequestPost = async (...args) => { return (POST as any)(...args); };
