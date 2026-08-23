import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId } from "../../_utils";
import type { Ctx } from "../../_utils";

// 模拟支付确认接口（仅用于开发/测试阶段）
// 正式对接微信/支付宝后需要移除或加权限限制
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;

  // 无需登录验证，方便开发调试；上线后请改为 requireAuth 或 IP 白名单
  const body = await request.json();
  const { orderId } = body as { orderId: string };
  if (!orderId) {
    return new Response(JSON.stringify({ error: "orderId 不能为空" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 查询订单
  const order = await env.DB.prepare(
    `SELECT * FROM orders WHERE id = ?`
  ).bind(orderId).first<any>();

  if (!order) {
    return new Response(JSON.stringify({ error: "订单不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (order.status !== "pending") {
    return new Response(JSON.stringify({ error: "订单状态不为 pending", orderId, status: order.status }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  let tokenRedeemCode: string | null = null;

  // 更新订单为 paid，写入 paid_at
  await env.DB.prepare(
    `UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?`
  ).bind(now, orderId).run();

  // 根据 purpose 执行后续逻辑
  if (order.purpose === "token_purchase") {
    // 生成 token 记录
    const tokenId = generateId();
    // 生成10位兑换码（大写+数字，排除易混淆字符 0/O/1/I）
    const redeemCode = generateRedeemCode();
    await env.DB.prepare(
      `INSERT INTO tokens (id, status, user_id, price, order_id, redeem_code, created_at)
       VALUES (?, 'unused', ?, ?, ?, ?, ?)`
    ).bind(tokenId, order.user_id, order.amount, orderId, redeemCode, now).run();

    // 回写订单的 token_id
    await env.DB.prepare(
      `UPDATE orders SET token_id = ? WHERE id = ?`
    ).bind(tokenId, orderId).run();

    tokenRedeemCode = redeemCode;
  } else if (order.purpose === "influencer_apply") {
    // 将对应的达人申请记录从 pending_payment 更新为 pending（待人工审核）
    await env.DB.prepare(
      `UPDATE influencers SET status = 'pending', updated_at = ?
       WHERE order_id = ? AND status = 'pending_payment'`
    ).bind(now, orderId).run();
  }

  return new Response(
    JSON.stringify({ success: true, orderId, purpose: order.purpose, redeemCode: tokenRedeemCode }),
    { headers: { "Content-Type": "application/json" } }
  );
};

/**
 * 生成10位兑换码：大写字母+数字，排除 0/O/1/I 等易混淆字符
 */
function generateRedeemCode(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return code;
}

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
