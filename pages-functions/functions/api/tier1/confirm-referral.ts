import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier1/confirm-referral
// 朋友完成 tier1 analyze 后调用，将 share_referrals 标记为已转化
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
  const { ref } = body as { ref: string };
  if (!ref) {
    return new Response(JSON.stringify({ error: "缺少 ref token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 查 share_referrals，token 存在且未转化
  const refRecord = await env.DB.prepare(
    `SELECT id, converted_user_id FROM share_referrals WHERE token = ? LIMIT 1`
  )
    .bind(ref)
    .first<any>();

  // token 不存在或已被转化过，静默忽略
  if (!refRecord || refRecord.converted_user_id !== null) {
    return new Response(JSON.stringify({ confirmed: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  // 标记转化
  await env.DB.prepare(
    `UPDATE share_referrals SET converted_user_id = ?, converted_at = ? WHERE token = ?`
  )
    .bind(user.userId, now, ref)
    .run();

  return new Response(JSON.stringify({ confirmed: true }), {
    headers: { "Content-Type": "application/json" },
  });
};


// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};






