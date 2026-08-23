import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId, beijingDate } from "../../_utils";
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

  const now = Math.floor(Date.now() / 1000);
  const token = generateId();
  const shareId = generateId();

  // 插入 share_referrals 记录
  await env.DB.prepare(
    `INSERT INTO share_referrals (id, token, sharer_user_id, source_report_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(shareId, token, user.userId, reportId, now)
    .run();

  // 乐观解锁 tier2：检查今日是否已有 unlock_method='share' 记录，无则插入占位记录
  const today = beijingDate();
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
    // 写入占位记录，包含 source_tier1_report_id、share_token、generation_status=pending
    await env.DB.prepare(
      `INSERT INTO reports_tier2
         (id, user_id, source_tier1_report_id, share_token, generation_status, content, unlock_method, created_at)
       VALUES (?, ?, ?, ?, 'pending', '{"status":"pending"}', 'share', ?)`
    )
      .bind(unlockId, user.userId, reportId, token, now)
      .run();
  }

  // TODO: base URL 应从环境变量读取，目前先用相对路径由前端拼接
  const baseUrl = (env as any).BASE_URL || "";
  const shareUrl = baseUrl
    ? `${baseUrl}/capture?ref=${token}`
    : `/capture?ref=${token}`;

  return new Response(
    JSON.stringify({ token, shareUrl }),
    { headers: { "Content-Type": "application/json" } }
  );
};


// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};






