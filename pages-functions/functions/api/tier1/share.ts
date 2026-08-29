import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId, beijingDate, parseDeepseekJson, callDeepSeekTier2 } from "../../_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier1/share
// 生成分享 token，插入 share_referrals，并乐观解锁今日 tier2
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
  const { reportId } = body as { reportId: string };
  if (!reportId) {
    return new Response(JSON.stringify({ error: "缺少 reportId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const today = beijingDate();
  const MAX_DAILY = 1;

  // 每日限次检查：查询 tier2_daily_usage，若今日已达上限则拒绝
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

  const now = Math.floor(Date.now() / 1000);
  const token = generateId();
  const shareId = generateId();
  let tier2ReportId: string | null = null;

  // 插入 share_referrals 记录
  await env.DB.prepare(
    `INSERT INTO share_referrals (id, token, sharer_user_id, source_report_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(shareId, token, user.userId, reportId, now)
    .run();

  // 乐观解锁 tier2：检查今日是否已有 unlock_method='share' 记录，无则插入占位记录
  const todayStartUnix = Math.floor(
    new Date(today + "T00:00:00+08:00").getTime() / 1000
  );
  const todayEndUnix = todayStartUnix + 24 * 60 * 60;

  const existing = await env.DB.prepare(
    `SELECT 1 FROM reports_tier2 WHERE user_id = ? AND unlock_method = 'share'
     AND created_at >= ? AND created_at < ? LIMIT 1`
  )
    .bind(user.userId, todayStartUnix, todayEndUnix)
    .first();

  if (!existing) {
    const unlockId = generateId();
    tier2ReportId = unlockId;
    // 写入记录，generation_status=processing，立即触发后台生成
    await env.DB.prepare(
      `INSERT INTO reports_tier2
         (id, user_id, source_tier1_report_id, share_token, generation_status, content, unlock_method, created_at)
       VALUES (?, ?, ?, ?, 'processing', '{"status":"processing"}', 'share', ?)`
    )
      .bind(unlockId, user.userId, reportId, token, now)
      .run();
    context.waitUntil(triggerTier2Generation(reportId, unlockId, env));
  } else {
    // 已有分享记录，查出 tier2ReportId 返回给前端
    const existingRow = await env.DB.prepare(
      `SELECT id, generation_status FROM reports_tier2 WHERE user_id = ? AND source_tier1_report_id = ? AND unlock_method = 'share' ORDER BY created_at DESC LIMIT 1`
    ).bind(user.userId, reportId).first<any>();
    if (existingRow) {
      tier2ReportId = existingRow.id;
      // 如果还是 pending 或 failed，重新启动生成
      if (existingRow.generation_status === 'pending' || existingRow.generation_status === 'failed') {
        context.waitUntil(triggerTier2Generation(reportId, existingRow.id, env));
      }
    }
  }

  const baseUrl = (env as any).BASE_URL || "";
  const shareUrl = baseUrl
    ? `${baseUrl}/capture?ref=${token}`
    : `/capture?ref=${token}`;

  return new Response(
    JSON.stringify({ token, shareUrl, tier2ReportId }),
    { headers: { "Content-Type": "application/json" } }
  );
};



async function triggerTier2Generation(tier1ReportId: string, tier2Id: string, env: Ctx["env"]): Promise<void> {
  try {
    const tier1Row = await env.DB.prepare(
      `SELECT report_data FROM reports_tier1 WHERE id = ? LIMIT 1`
    ).bind(tier1ReportId).first<any>();
    if (!tier1Row) return;
    const tier1Report = JSON.parse(tier1Row.report_data);
    const tier2Content = await callDeepSeekTier2(tier1Report, env);
    if (tier2Content) {
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        `UPDATE reports_tier2 SET content = ?, generation_status = 'ready', updated_at = ? WHERE id = ?`
      ).bind(JSON.stringify(tier2Content), now, tier2Id).run();
      console.log(`[tier1/share] Generated tier2 for ${tier2Id}`);
    } else {
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        `UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`
      ).bind(now, tier2Id).run();
      console.error(`[tier1/share] Failed to generate tier2 for ${tier2Id}`);
    }
  } catch (e) {
    console.error(`[tier1/share] Exception generating tier2:`, e);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`
    ).bind(now, tier2Id).run();
  }
}


// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
