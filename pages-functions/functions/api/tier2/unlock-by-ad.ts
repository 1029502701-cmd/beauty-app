import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, beijingDate, generateId } from "../../_utils";

export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  console.log("[unlock-by-ad] user:", JSON.stringify(user));
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { tier1ReportId } = body as { tier1ReportId: string };
  console.log("[unlock-by-ad] tier1ReportId:", tier1ReportId);
  if (!tier1ReportId) {
    return new Response(JSON.stringify({ error: "缺少 tier1ReportId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = beijingDate();
  const MAX_DAILY = 1;
  console.log("[unlock-by-ad] today:", today, "MAX_DAILY:", MAX_DAILY);

  // 1. Check daily usage
  const usageRow = await env.DB.prepare(
    `SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  ).bind(user.userId, today).first<any>();
  console.log("[unlock-by-ad] usageRow:", JSON.stringify(usageRow), "userId:", user.userId);

  if (usageRow && usageRow.used_count >= MAX_DAILY) {
    console.log("[unlock-by-ad] BLOCKED by tier2_daily_usage: used_count=" + usageRow.used_count);
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "今日进阶报告次数已用完，明天再来吧" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Check reports_tier2 duplicate
  const todayEpoch = Math.floor(new Date(today + "T00:00:00+08:00").getTime() / 1000);
  const existing = await env.DB.prepare(
    `SELECT id FROM reports_tier2 WHERE user_id = ? AND unlock_method = 'ad' AND created_at >= ? LIMIT 1`
  ).bind(user.userId, todayEpoch).first<any>();
  console.log("[unlock-by-ad] existing:", JSON.stringify(existing), "todayEpoch:", todayEpoch);

  if (existing) {
    console.log("[unlock-by-ad] BLOCKED by existing report: id=" + existing.id);
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "今日进阶报告次数已用完，明天再来吧" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. Insert placeholder
  const now = Math.floor(Date.now() / 1000);
  const tier2Id = generateId();
  await env.DB.prepare(
    `INSERT INTO reports_tier2 (id, user_id, source_tier1_report_id, generation_status, content, unlock_method, created_at)
     VALUES (?, ?, ?, 'pending', '{"status":"pending"}', 'ad', ?)`
  ).bind(tier2Id, user.userId, tier1ReportId, now).run();
  console.log("[unlock-by-ad] inserted report:", tier2Id);

  // 4. Update daily counter
  if (!usageRow) {
    await env.DB.prepare(
      `INSERT INTO tier2_daily_usage (user_id, usage_date, used_count) VALUES (?, ?, 1)`
    ).bind(user.userId, today).run();
  } else {
    await env.DB.prepare(
      `UPDATE tier2_daily_usage SET used_count = used_count + 1 WHERE user_id = ? AND usage_date = ?`
    ).bind(user.userId, today).run();
  }
  console.log("[unlock-by-ad] updated daily usage for userId:", user.userId);

  return new Response(
    JSON.stringify({ tier2ReportId: tier2Id, unlocked: true }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
