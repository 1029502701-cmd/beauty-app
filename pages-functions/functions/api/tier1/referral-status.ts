import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import type { Ctx } from "../../_utils";

// GET /api/tier1/referral-status?token=xxx
// 返回该 token 是否已转化（供"看广告解锁图片"页面轮询使用）
export const GET: FrameworkCallbackOptions["GET"] = async (
  { request, env },
  _ctx: Ctx
) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response(JSON.stringify({ error: "缺少 token 参数" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = await env.DB.prepare(
    `SELECT converted_user_id FROM share_referrals WHERE token = ? LIMIT 1`
  )
    .bind(token)
    .first<any>();

  const converted = row !== null && row.converted_user_id !== null;

  return new Response(
    JSON.stringify({ converted }),
    { headers: { "Content-Type": "application/json" } }
  );
};


// wrangler v4 compatibility: alias for route discovery
export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};

