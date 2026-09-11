import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, beijingDate, generateId } from "../../_utils";

// POST /api/tier2/unlock-by-ad
// 进阶报告独立解锁：看广告预留当日名额，创建独立的 pending 报告记录
// 不再依赖初识报告，也不再自动触发生成——生成由前端上传照片后调用 /tier2/generate-standalone 完成
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = beijingDate();
  const MAX_DAILY = 1;

  // 1. Check daily usage
  const usageRow = await env.DB.prepare(
    `SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  ).bind(user.userId, today).first<any>();

  if (usageRow && usageRow.used_count >= MAX_DAILY) {
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "今日进阶报告次数已用完，明天再来吧" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Insert placeholder（独立报告：不关联初识报告，保留用户历史报告）
  const now = Math.floor(Date.now() / 1000);
  const tier2Id = generateId();
  await env.DB.prepare(
    `INSERT INTO reports_tier2 (id, user_id, source_tier1_report_id, generation_status, content, unlock_method, created_at)
     VALUES (?, ?, NULL, 'pending', '{"status":"pending"}', 'ad', ?)`
  ).bind(tier2Id, user.userId, now).run();

  // 3. Update daily counter
  if (!usageRow) {
    await env.DB.prepare(
      `INSERT INTO tier2_daily_usage (user_id, usage_date, used_count) VALUES (?, ?, 1)`
    ).bind(user.userId, today).run();
  } else {
    await env.DB.prepare(
      `UPDATE tier2_daily_usage SET used_count = used_count + 1 WHERE user_id = ? AND usage_date = ?`
    ).bind(user.userId, today).run();
  }

  return new Response(
    JSON.stringify({ tier2ReportId: tier2Id, unlocked: true, generationStatus: "pending" }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};