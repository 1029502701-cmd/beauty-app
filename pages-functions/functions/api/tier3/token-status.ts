import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId } from "../../_utils";
import type { Ctx } from "../../_utils";

// GET /api/tier3/token-status
// 查询当前登录用户是否有可用 token，返回 { hasToken, count }
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM tokens WHERE user_id = ? AND status = 'unused'`
  )
    .bind(user.userId)
    .first<{ cnt: number }>();

  const count = row?.cnt ?? 0;
  return new Response(
    JSON.stringify({ hasToken: count > 0, count }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestGet = GET;
