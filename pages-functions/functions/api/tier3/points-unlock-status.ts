import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";

// GET /api/tier3/points-unlock-status
// 查询当前用户是否已通过积分解锁专属报告（本端 tier3_points_unlock 持久化记录）。
// 用于刷新/换设备后恢复"已解锁资格"，避免只依赖前端内存态。
// 响应: { unlocked, source, reportRef, unlockedAt, balance }
//   - balance 顺带回传（本端 proxy 读 auth-center 余额），便于前端一次性拿到"资格+最新余额"。

const AUTH_CENTER_URL = "https://auth.meijian.top";

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = await env.DB.prepare(
    `SELECT source, report_ref, unlocked_at FROM tier3_points_unlock WHERE user_id = ? LIMIT 1`
  )
    .bind(user.userId)
    .first<{ source: string; report_ref: string | null; unlocked_at: number }>();

  let balance: number | null = null;
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer /, "");
  if (token) {
    try {
      const res = await fetch(AUTH_CENTER_URL + "/api/points/balance", {
        method: "GET",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.balance === "number") balance = data.balance;
    } catch (e) {
      console.warn("[tier3/points-unlock-status] balance proxy failed:", e);
    }
  }

  return new Response(
    JSON.stringify({
      unlocked: !!row,
      source: row?.source || null,
      reportRef: row?.report_ref || null,
      unlockedAt: row?.unlocked_at ?? null,
      balance,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestGet = GET;
