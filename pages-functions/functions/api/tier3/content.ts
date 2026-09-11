import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";

// GET /api/tier3/content
// 个人中心：返回当前用户最新的、未过期的专属（tier3）报告的简要信息
// （妆容风格 + 到期时间），用于个人中心轻展示
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const now = Math.floor(Date.now() / 1000);
  // 1. 最新且未过期的专属报告（场景 + 到期时间）
  const row = await env.DB.prepare(
    `SELECT scenario, expire_at FROM reports_tier3 WHERE user_id = ? AND expire_at > ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(user.userId, now)
    .first<any>();
  if (!row) {
    return new Response(JSON.stringify({ found: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }
  // 2. 妆容风格：取用户最新初识报告的 personaTags（短标签），否则回退到专属报告场景
  const t1 = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(user.userId)
    .first<any>();
  let style: string | null = null;
  try {
    if (t1) style = JSON.parse(t1.report_data)?.personaTags || null;
  } catch {
    style = null;
  }
  if (!style) style = row.scenario || null;
  return new Response(
    JSON.stringify({
      found: true,
      style,
      scenario: row.scenario || null,
      expireAt: row.expire_at ?? null,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestGet = GET;
