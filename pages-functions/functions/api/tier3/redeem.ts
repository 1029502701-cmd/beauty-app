import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier3/redeem-token
// 用户输入兑换码，将 token 绑定到当前登录用户（转赠逻辑核心）
// 入参：{ code: string }
// 返回：{ success: true } 或 { error: "invalid_code", message: "..." }
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
  const { code } = body as { code: string };
  if (!code) {
    return new Response(JSON.stringify({ error: "invalid_code", message: "请输入兑换码" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 查找兑换码对应的 token，且必须满足：status='unused' 且 user_id 尚未绑定（即未被其他人兑换）
  const tokenRow = await env.DB.prepare(
    `SELECT id, user_id FROM tokens WHERE redeem_code = ? AND status = 'unused' LIMIT 1`
  )
    .bind(code.trim().toUpperCase())
    .first<{ id: string; user_id: string | null }>();

  if (!tokenRow) {
    return new Response(
      JSON.stringify({ error: "invalid_code", message: "兑换码无效或已被使用" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 如果 user_id 已有值，说明该 token 已被其他用户兑换
  if (tokenRow.user_id !== null) {
    return new Response(
      JSON.stringify({ error: "invalid_code", message: "兑换码无效或已被使用" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 将 token 的 user_id 绑定为当前用户（status 保持 unused，真正消耗在 generate 时）
  await env.DB.prepare(
    `UPDATE tokens SET user_id = ? WHERE id = ?`
  )
    .bind(user.userId, tokenRow.id)
    .run();

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
