import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { probeAuthCenterSession, extractJwt } from "../../_utils";
import type { Ctx } from "../../_utils";

// GET /api/auth/cookie-check
// 判断"浏览器 cookie 里是否有有效的中枢登录态"。
// 前端不存/不读 token：中枢（auth.meijian.top）登录后下发共享域 HttpOnly cookie，
// 本端与中枢同属 *.meijian.top，浏览器对本端同源请求自动带上该 cookie。
// 本端把 cookie 里的 JWT 转给中枢做校验（中枢认识自己的 JWT），返回 200 表示有效。
// 无效/无 token → 前端跳 auth.meijian.top 登录（带 ?redirect= 当前页）。
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const ok = await probeAuthCenterSession(env, request);
  if (ok) {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: false }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestGet = async (...args) => (GET as any)(...args);
