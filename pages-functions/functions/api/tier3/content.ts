import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";

// GET /api/tier3/content
// 个人中心：返回当前用户已生成的专属（tier3）报告档案列表。
// 专属报告为"纯新增"模式：每生成一份都是一条独立档案（不互相覆盖），
// 按生成时间倒序返回，前端档案页逐条展示、可点击查看详情。
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

  // 用户最新一份初识报告的 personaTags（短标签），作为"妆容风格"展示回退
  let t1Style: string | null = null;
  const t1 = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(user.userId)
    .first<any>();
  try {
    if (t1) t1Style = JSON.parse(t1.report_data)?.personaTags || null;
  } catch {
    t1Style = null;
  }

  // 该用户的全部专属报告档案（含已过期，前端按需标记过期状态）
  let rows;
  try {
    rows = await env.DB.prepare(
      `SELECT id, scenario, face_photo_key, ai_image_url, created_at, expire_at
       FROM reports_tier3
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(user.userId).all<any>();
  } catch (e) {
    console.warn("[tier3/content] ai_image_url missing, legacy select:", e);
    rows = await env.DB.prepare(
      `SELECT id, scenario, face_photo_key, created_at, expire_at
       FROM reports_tier3
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(user.userId).all<any>();
  }

  const reports = (rows.results || []).map((r) => ({
    id: r.id,
    scenario: r.scenario || null,
    style: t1Style || r.scenario || null,
    photoUrl: r.face_photo_key
      ? "/api/r2-proxy?key=" + encodeURIComponent(r.face_photo_key) + "&bucket=temp"
      : null,
    aiImageUrl: r.ai_image_url
      ? "/api/r2-proxy?key=" + encodeURIComponent(r.ai_image_url) + "&bucket=temp"
      : null,
    createdAt: r.created_at ?? null,
    expireAt: r.expire_at ?? null,
    expired: typeof r.expire_at === "number" ? r.expire_at <= now : false,
  }));

  // 是否已通过积分解锁（本端 tier3_points_unlock 记录），用于刷新/换设备后恢复资格
  const unlockRow = await env.DB.prepare(
    `SELECT unlocked_at FROM tier3_points_unlock WHERE user_id = ? LIMIT 1`
  )
    .bind(user.userId)
    .first<{ unlocked_at: number }>();

  return new Response(
    JSON.stringify({ found: reports.length > 0, reports, pointsUnlocked: !!unlockRow }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestGet = GET;
