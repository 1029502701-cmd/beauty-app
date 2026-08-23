import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId } from "../../_utils";
import type { Ctx } from "../../_utils";

// 创建订单，调用微信/支付宝 H5 下单接口，返回支付链接
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
  const { channel, purpose } = body as {
    channel?: "wechat" | "alipay" | "mock";
    purpose?: "token_purchase" | "influencer_apply";
  };

  const now = Math.floor(Date.now() / 1000);
  const orderId = generateId();
  const outTradeNo = `BEAUTY${Date.now()}${generateId().slice(0, 4)}`;
  const orderPurpose = purpose ?? "token_purchase";

  // 从 app_config 读取 tier3 token 价格，兜底默认 660 分
  const priceRow = await env.DB.prepare(
    `SELECT value FROM app_config WHERE key = 'tier3_token_price'`
  ).first<{ value: string }>();
  const amount = priceRow ? parseInt(priceRow.value, 10) : 660;

  // 写入 orders 表
  await env.DB.prepare(
    `INSERT INTO orders (id, user_id, amount, channel, status, out_trade_no, purpose, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).bind(orderId, user.userId, amount, channel ?? "mock", outTradeNo, orderPurpose, now).run();

  // payUrl 指向本项目内部的模拟支付页（仅开发/测试使用）
  const payUrl = `/mock-pay.html?orderId=${orderId}`;

  return new Response(
    JSON.stringify({ orderId, payUrl, outTradeNo, amount }),
    { headers: { "Content-Type": "application/json" } }
  );
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
