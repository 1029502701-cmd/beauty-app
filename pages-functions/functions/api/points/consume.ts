// POST /api/points/consume
// 扣积分：带中枢服务令牌调 /api/sync/points/consume（once:true 一人一次去重）。
// 安全约定：reason/amount/once 全部由本端服务端决定，禁止直接透传前端值（防改价）。
// - amount：本端服务端写死后填入（解锁专属报告固定 6 积分）；
// - reason：按业务事件生成（如 unlock_report_<reportId>）；
// - once：同一报告一人一次传 true，可重复兑换不带。
import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, resolveUserPhone, authCenterPoints } from "../../_utils";

// 解锁专属（3 档）报告的固定价格（积分）。由本端服务端写死，勿改造成透传前端值。
const UNLOCK_REPORT_AMOUNT = 6;

export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let reason: string;
  let amount: number;
  let once: boolean;
  try {
    const body = (await request.json()) as { action?: string; reportId?: string };
    if (body.action === "unlock_report" && body.reportId) {
      // 解锁专属报告：价格服务端定死，reason 带 reportId 实现一人一次去重
      reason = "unlock_report_" + body.reportId;
      amount = UNLOCK_REPORT_AMOUNT;
      once = true;
    } else {
      // 其它业务事件（如普通兑换）：reason 由前端指定（业务事件标识），金额仍由本端定
      if (!body.action) {
        return new Response(
          JSON.stringify({ error: "缺少 action" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      reason = body.action;
      amount = UNLOCK_REPORT_AMOUNT;
      once = false;
    }
  } catch {
    return new Response(
      JSON.stringify({ error: "请求体不是合法 JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const phone = await resolveUserPhone(request, env, user);
  if (!phone) {
    return new Response(
      JSON.stringify({ consumed: false, balance: 0, reason: "未找到手机号，无法扣减积分" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // 无论是否扣减，都顺带回传当前余额（让美妆端一次拿全"是否扣 + 最新余额"）
  let currentBalance: number | null = null;
  const balRes = await authCenterPoints(env, "/api/sync/points", { phone });
  if (balRes.ok && typeof balRes.balance === "number") currentBalance = balRes.balance;

  try {
    const payload: Record<string, unknown> = { reason, amount };
    if (once) payload.once = true;
    const res = await authCenterPoints(env, "/api/sync/points/consume", {
      phone,
      method: "POST",
      body: { ...payload, phone },
    });
    if (!res.ok) {
      // 402 积分不足等：原样透传状态与原因，前端据此决定是否保持未解锁
      return new Response(
        JSON.stringify({
          consumed: false,
          balance: (res as any).balance ?? currentBalance ?? null,
          reason: (res as any).reason || (res as any).error || "扣减失败",
        }),
        { status: (res as any).status || 402, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        consumed: !!res.consumed,
        balance: (res as any).balance ?? currentBalance ?? 0,
        reason: (res as any).reason || reason,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[points/consume] proxy error:", err);
    return new Response(
      JSON.stringify({ error: "网络错误，请稍后重试" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const onRequestPost = async (...args: unknown[]) => {
  return (POST as any)(...args);
};
