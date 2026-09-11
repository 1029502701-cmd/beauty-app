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

  // 从计数器表取今日已用次数（与 tier1/analyze.ts 的写入逻辑保持一致）
  const usageRow = await env.DB.prepare(
    `SELECT used_count FROM tier1_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  ).bind(user.userId, today).first<any>();
  const usedCount = usageRow?.used_count ?? 0;

  // 同时查最新的报告记录（不再按日期筛选，固定档案模式）
  const result = await env.DB.prepare(
    `SELECT id, report_data, created_at FROM reports_tier1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(user.userId).first<any>();


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
