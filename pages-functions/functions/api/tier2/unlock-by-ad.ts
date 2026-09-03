import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, beijingDate, generateId } from "../../_utils";

// POST /api/tier2/unlock-by-ad
// 看广告解锁进阶报告：检查每日限次，插入 unlock_method='ad' 的占位记录
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { tier1ReportId } = body as { tier1ReportId: string };
  if (!tier1ReportId) {
    return new Response(JSON.stringify({ error: "缺少 tier1ReportId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = beijingDate();
  const MAX_DAILY = 1;

  // 1. 检查今日是否已解锁过（无论是 share 还是 ad）
  const usageRow = await env.DB.prepare(
    `SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  )
    .bind(user.userId, today)
    .first<any>();

  if (usageRow && usageRow.used_count >= MAX_DAILY) {
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "今日进阶报告次数已用完，明天再来吧" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. 检查今天是否已有 reports_tier2 记录（无论 unlock_method）
  const existing = await env.DB.prepare(
    `SELECT id FROM reports_tier2 WHERE user_id = ? AND created_at >= ? LIMIT 1`
  )
    .bind(user.userId, Math.floor(new Date(today + "T00:00:00+08:00").getTime() / 1000))
    .first<any>();

  if (existing) {
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "今日进阶报告次数已用完，明天再来吧" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. 插入占位记录，unlock_method='ad'，generation_status='pending'
  const now = Math.floor(Date.now() / 1000);
  const tier2Id = generateId();
  await env.DB.prepare(
    `INSERT INTO reports_tier2
       (id, user_id, source_tier1_report_id, generation_status, content, unlock_method, created_at)
     VALUES (?, ?, ?, 'pending', '{"status":"pending"}', 'ad', ?)`
  )
    .bind(tier2Id, user.userId, tier1ReportId, now)
    .run();

  return new Response(
    JSON.stringify({ tier2ReportId: tier2Id, unlocked: true }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
