import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";

// 仅本地开发环境可用：从 KV 读取最近一条 SMS 验证码，供测试使用
// 生产环境无 DEBUG_MODE，此端点直接返回 404
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { env, request } = context;
  // 仅本地开发（DEBUG_MODE=1）时放行
  if (!env.DEBUG_MODE) {
    return new Response(JSON.stringify({error:"not available in production"}),{status:404});
  }
  const url = new URL(request.url);
  const phone = url.searchParams.get("phone");
  if (!phone) return new Response(JSON.stringify({error:"missing phone"}),{status:400});
  const key = "sms_code:" + phone;
  const stored = await env.SESSION_KV.get(key);
  if (!stored) return new Response(JSON.stringify({error:"code not found or expired"}),{status:404});
  const { code } = JSON.parse(stored);
  return new Response(JSON.stringify({key,code}));
};

export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
}