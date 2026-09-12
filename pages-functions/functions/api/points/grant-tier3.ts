// POST /api/points/grant-tier3
// 代理调用中枢 /api/sync/points/grant-tier3（3 档报告生成成功后 +20，一人一次，中枢去重）。
// 带中枢服务令牌（AUTH_CENTER_SERVICE_TOKEN）+ 解析出的手机号；不再透传用户 JWT。
import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, resolveUserPhone, authCenterPoints } from "../../_utils";

export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
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
      JSON.stringify({ error: "未找到手机号，无法赠送积分", granted: false }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const res = await authCenterPoints(env, "/api/sync/points/grant-tier3", {
    phone,
    method: "POST",
    body: { phone },
  });
  if (!res.ok) {
    return new Response(
      JSON.stringify({
        error: (res as any).error || "赠送积分失败",
        granted: false,
        balance: typeof res.balance === "number" ? res.balance : null,
      }),
      { status: (res as any).status || 502, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(
    JSON.stringify({
      granted: !!res.granted,
      balance: typeof res.balance === "number" ? res.balance : 0,
      reason: (res as any).reason || "tier3_report",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost = async (...args: unknown[]) => {
  return (POST as any)(...args);
};
