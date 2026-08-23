import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";

// GET /api/tier1/validate?id=<reportId>
// 轻量校验：检查当前用户是否有权限访问该 tier1 报告
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const reportId = url.searchParams.get("id");
  if (!reportId) {
    return new Response(JSON.stringify({ valid: false }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = await env.DB.prepare(
    "SELECT 1 FROM reports_tier1 WHERE id = ? AND user_id = ? LIMIT 1"
  )
    .bind(reportId, user.userId)
    .first();

  return new Response(
    JSON.stringify({ valid: !!row }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};