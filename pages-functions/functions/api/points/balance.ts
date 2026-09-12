import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, resolveUserPhone, authCenterPoints } from "../../_utils";

// GET /api/points/balance
// 读积分：带中枢服务令牌调 /api/sync/points?phone=<手机号>（手机号来自 JWT claim / 本端 D1 / KV session）。
// 不再透传用户 JWT 给中枢。
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phone = await resolveUserPhone(request, env, user);
  if (!phone) {
    return new Response(
      JSON.stringify({ balance: 0, note: "未找到手机号，积分按 0 处理" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const res = await authCenterPoints(env, "/api/sync/points", { phone });
  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: (res as any).error || "获取积分失败", balance: 0 }),
      { status: (res as any).status || 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({ balance: typeof res.balance === "number" ? res.balance : 0 }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestGet = async (...args: unknown[]) => {
  return (GET as any)(...args);
};
