import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";

// POST /api/tier3/points-unlock-record
// 前端在"扣积分成功"后调用，把本端解锁资格落库（幂等：已存在则不重复写）。
// 入参：{ reportRef?: string }
// 响应: { recorded: boolean, unlockedAt: number }
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let reportRef: string | undefined;
  try {
    const body = (await request.json()) as { reportRef?: string };
    reportRef = body?.reportRef;
  } catch {
    // body 非 JSON 也可继续（reportRef 留空），不做硬性校验
  }

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO tier3_points_unlock (user_id, source, report_ref, unlocked_at)
     VALUES (?, 'points', ?, ?)`
  )
    .bind(user.userId, reportRef || null, now)
    .run();

  const row = await env.DB.prepare(
    `SELECT unlocked_at FROM tier3_points_unlock WHERE user_id = ? LIMIT 1`
  )
    .bind(user.userId)
    .first<{ unlocked_at: number }>();

  return new Response(
    JSON.stringify({ recorded: true, unlockedAt: row?.unlocked_at ?? now }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost = POST;
