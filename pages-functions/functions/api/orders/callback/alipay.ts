import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { generateId } from "../../_utils";
import type { Ctx } from "../../_utils";

// 支付宝异步回调：验签 → 更新订单为 paid → 生成 token
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const body = await request.text();
  // TODO: 解析 form 数据，验签（使用支付宝公钥）
  // TODO: 逻辑同 wechat callback
  // TODO: 返回 success

  return new Response("success");
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};




