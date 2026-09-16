import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId, beijingDate } from "../../_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier1/share
// 生成分享 token 和 share_referrals 记录
// 注意：分享不再自动触发 tier2 生成，仅用于邀请好友
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

  const baseUrl = (env as any).BASE_URL || "https://beauty.meijian.top";
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