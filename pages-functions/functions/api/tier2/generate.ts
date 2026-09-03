import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, parseDeepseekJson, callDeepSeekTier2 } from "../../_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier2/generate
// 异步模式：立即返回 processing，后台生成后更新为 ready
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
  const { reportId } = body as { reportId: string };
  if (!reportId) {
    return new Response(JSON.stringify({ error: "缺少 reportId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1. 查询 tier2 记录，确认归属当前用户
  // 先按 tier2 ID 查找（share/ad 解锁流程传入的是 tier2Id）
  let tier2Row = await env.DB.prepare(
    `SELECT id, generation_status, content, source_tier1_report_id
     FROM reports_tier2 WHERE id = ? AND user_id = ? LIMIT 1`
  )
    .bind(reportId, user.userId)
    .first<any>();

  // 若未找到，再按 source_tier1_report_id 查找（前端直接传 tier1 reportId 的场景）
  if (!tier2Row) {
    tier2Row = await env.DB.prepare(
      `SELECT id, generation_status, content, source_tier1_report_id
       FROM reports_tier2 WHERE source_tier1_report_id = ? AND user_id = ? LIMIT 1`
    )
      .bind(reportId, user.userId)
      .first<any>();
  }

  if (!tier2Row) {
    return new Response(JSON.stringify({ error: "报告不存在或无权访问" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. 已生成直接返回（幂等）
  if (tier2Row.generation_status === "ready") {
    try {
      const content = JSON.parse(tier2Row.content);
      return new Response(JSON.stringify({ id: tier2Row.id, content, generationStatus: "ready" }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // content 损坏，继续异步生成
    }
  }

  // 3. 没有 source_tier1_report_id，无法生成
  if (!tier2Row.source_tier1_report_id) {
    return new Response(
      JSON.stringify({ error: "缺少 source_tier1_report_id，无法生成报告" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. 查 tier1 报告内容
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = ? LIMIT 1`
  )
    .bind(tier2Row.source_tier1_report_id)
    .first<any>();

  if (!tier1Row) {
    return new Response(
      JSON.stringify({ error: "源 tier1 报告不存在" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  let tier1Report: Record<string, unknown>;
  try {
    tier1Report = JSON.parse(tier1Row.report_data) as Record<string, unknown>;
  } catch {
    return new Response(
      JSON.stringify({ error: "tier1 报告数据解析失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 5. 立即标记为 processing
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE reports_tier2 SET generation_status = 'processing', updated_at = ? WHERE id = ?`
  ).bind(now, tier2Row.id).run();

  // 6. 立即返回，后台异步生成（不阻塞响应）
  context.waitUntil(generateTier2Async(tier1Report, tier2Row.id, env));

  return new Response(JSON.stringify({ id: tier2Row.id, generationStatus: "processing" }), {
    headers: { "Content-Type": "application/json" },
  });
};

async function generateTier2Async(tier1Report: Record<string, unknown>, tier2Id: string, env: Ctx["env"]): Promise<void> {
  try {
    const tier2Content = await callDeepSeekTier2(tier1Report, env);
    if (tier2Content) {
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        `UPDATE reports_tier2 SET content = ?, generation_status = 'ready', updated_at = ? WHERE id = ?`
      ).bind(JSON.stringify(tier2Content), now, tier2Id).run();
      console.log(`[tier2/generate] Successfully generated for ${tier2Id}`);
    } else {
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        `UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`
      ).bind(now, tier2Id).run();
      console.error(`[tier2/generate] Failed to generate for ${tier2Id}`);
    }
  } catch (e) {
    console.error(`[tier2/generate] Async exception for ${tier2Id}:`, e);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`
    ).bind(now, tier2Id).run();
  }
}


// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
