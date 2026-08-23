import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";

// GET /api/tier2/status?tier1ReportId=xxx
// 查询指定 tier1 报告是否已有对应的 tier2 进阶报告
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
  const tier1ReportId = url.searchParams.get("tier1ReportId");
  if (!tier1ReportId) {
    return new Response(JSON.stringify({ error: "缺少 tier1ReportId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = await env.DB.prepare(
    `SELECT id FROM reports_tier2 WHERE source_tier1_report_id = ? AND user_id = ? LIMIT 1`
  )
    .bind(tier1ReportId, user.userId)
    .first<any>();

  if (row) {
    return new Response(
      JSON.stringify({ unlocked: true, tier2ReportId: row.id }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ unlocked: false }), {
    headers: { "Content-Type": "application/json" },
  });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
