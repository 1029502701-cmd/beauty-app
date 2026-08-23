import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import type { Ctx } from "../../_utils";

// 发送手机验证码
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { phone } = body as { phone: string };

  // 生成6位随机验证码
  const code = String(Math.floor(100000 + Math.random() * 900000));

  // 存入 KV，5分钟过期
  await env.SESSION_KV.put(
    `sms_code:${phone}`,
    JSON.stringify({ code, expiresAt: Math.floor(Date.now() / 1000) + 300 }),
    { expirationTtl: 300 }
  );

  // TODO: 对接真实短信服务商（阿里云/腾讯云 SMS）发送验证码
  // 本地开发时打印到控制台供测试
  console.log(`[SMS Code] ${phone} -> ${code}`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};