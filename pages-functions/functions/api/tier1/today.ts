import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, beijingDate } from "../../_utils";
import type { Ctx } from "../../_utils";

/**
 * GET /api/tier1/today
 * 查询用户今日已生成的 Tier1 报告（最新的）
 */
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = beijingDate();
  const todayStartUnix = Math.floor(new Date(today + "T00:00:00+08:00").getTime() / 1000);
  const todayEndUnix = todayStartUnix + 24 * 60 * 60;

  const result = await env.DB.prepare(
    `SELECT id, report_data, created_at FROM reports_tier1 WHERE user_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(user.userId, todayStartUnix, todayEndUnix)
    .first<any>();

  if (!result) {
    return new Response(JSON.stringify({ report: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let reportData;
  try {
    reportData = JSON.parse(result.report_data);
  } catch {
    reportData = {};
  }

  return new Response(JSON.stringify({
    report: reportData,
    reportId: result.id,
    createdAt: result.created_at,
  }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
