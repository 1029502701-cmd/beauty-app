import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier3/redeem
// 用户输入兑换码，核销码并绑定到当前登录用户（不经过积分，直接授权生成专属报告）
// 入参：{ code: string }
// 返回：{ success: true, redeemCode: string } 或 { error: "invalid_code", message: "..." }
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { code: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_code", message: "请求体不是合法 JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const code = body.code;
  if (!code || !code.trim()) {
    return new Response(JSON.stringify({ error: "invalid_code", message: "请输入兑换码" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const normalizedCode = code.trim().toUpperCase();

  // 先检查该用户是否已有已核销的码（每人限购一次，防重复核销）
  const existing = await env.DB.prepare(
    `SELECT 1 FROM tier3_redeem_codes WHERE user_id = ? AND status = 'used' LIMIT 1`
  )
    .bind(user.userId)
    .first();
  if (existing) {
    return new Response(
      JSON.stringify({ error: "invalid_code", message: "您已有未使用的兑换码资格，无需重复兑换" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 原子认领：仅当 status='unused' 时置为 used（防止并发双核销）
  const now = Math.floor(Date.now() / 1000);
  const claim = await env.DB.prepare(
    `UPDATE tier3_redeem_codes SET status = 'used', user_id = ?, used_at = ? WHERE code = ? AND status = 'unused'`
  )
    .bind(user.userId, now, normalizedCode)
    .run();

  if (!claim.meta?.changes) {
    return new Response(
      JSON.stringify({ error: "invalid_code", message: "兑换码无效或已被使用" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 返回核销成功的码，前端据此在生成时传 redeemCode（即 code 本身）
  return new Response(
    JSON.stringify({ success: true, redeemCode: normalizedCode }),
    { headers: { "Content-Type": "application/json" } }
  );
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
