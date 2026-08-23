import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import type { Ctx } from "../../_utils";

// 登出：删除 KV 中的 session
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  await env.SESSION_KV.delete(`session:${token}`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};






