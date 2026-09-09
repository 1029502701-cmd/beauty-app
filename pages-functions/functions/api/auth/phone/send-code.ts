import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import type { Ctx } from "../../_utils";

// 发送手机验证码（带哈希 + 尝试次数限制）
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { phone } = body as { phone: string };

  // 1. 检查尝试次数（最多5次，锁定60秒）
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
    if (lockedUntil && lockedUntil <= now) { await env.SESSION_KV.delete(attemptKey); }
  }

  // 2. 生成6位随机验证码
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // 3. HMAC-SHA256 哈希存储（防止KV明文泄露）
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(code), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", keyMaterial, enc.encode(phone));
  const codeHash = btoa(String.fromCharCode(...new Uint8Array(sig)));
  const now = Math.floor(Date.now() / 1000);

  // 4. 存入 KV，5分钟过期
  await env.SESSION_KV.put(`sms_code:${phone}`, JSON.stringify({ codeHash, expiresAt: now + 300 }), { expirationTtl: 300 });

  // TODO: 对接真实短信服务商
  console.log(`[SMS Code] ${phone} -> ${code}`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};

