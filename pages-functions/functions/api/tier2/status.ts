import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, callDeepSeekTier2 } from "../../_utils";
import type { Ctx } from "../../_utils";

const PROCESSING_STALE_THRESHOLD_SEC = 10 * 60; // 10 分钟视为卡死

// GET /api/tier2/status?tier1ReportId=xxx 或 ?tier2Id=xxx
export const GET = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const url = new URL(request.url);
  const tier1ReportId = url.searchParams.get("tier1ReportId");
  const tier2Id = url.searchParams.get("tier2Id");

  // 处理 tier2Id 查询
  if (tier2Id) {
    let row = await env.DB.prepare(
      `SELECT id, generation_status, content, source_tier1_report_id, updated_at FROM reports_tier2 WHERE id = ? AND user_id = ? LIMIT 1`
    ).bind(tier2Id, user.userId).first<any>();

    if (!row) {
      return new Response(JSON.stringify({ error: "报告不存在或无权访问" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    // 卡死保护：processing 状态超过阈值，视为失败并重置重试
    if (row.generation_status === "processing") {
      const now = Math.floor(Date.now() / 1000);
      const lastUpdate = row.updated_at ?? row.created_at;
      if (now - lastUpdate > PROCESSING_STALE_THRESHOLD_SEC) {
        console.warn(`[tier2/status] Stale processing record ${row.id} (stuck ${now - lastUpdate}s), resetting to pending`);
        await env.DB.prepare(
          `UPDATE reports_tier2 SET generation_status = 'pending', updated_at = ? WHERE id = ?`
        ).bind(now, row.id).run();
        row = { ...row, generation_status: "pending" };
      }
    }

    if (row.generation_status === "pending" && row.content === JSON.stringify({status:"pending"})) {
      const tier1Row = await env.DB.prepare(
        `SELECT report_data FROM reports_tier1 WHERE id = (SELECT source_tier1_report_id FROM reports_tier2 WHERE id = ? LIMIT 1)`
      ).bind(row.id).first<any>();
      if (tier1Row) { try {
        const tier1Report = JSON.parse(tier1Row.report_data) as Record<string, unknown>;
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare(`UPDATE reports_tier2 SET generation_status = 'processing', updated_at = ? WHERE id = ?`).bind(now, row.id).run();
        context.waitUntil(generateTier2Async(tier1Report, row.id, env));
        return new Response(JSON.stringify({ generationStatus: "processing", tier2ReportId: row.id }), { headers: { "Content-Type": "application/json" } });
      } catch { /* JSON parse failed */ } }
    }

    const result = { generationStatus: row.generation_status, tier2ReportId: row.id };
    if (row.generation_status === "ready" && row.content) { try { result.content = JSON.parse(row.content); } catch { result.content = null; } }
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  }

  // 处理 tier1ReportId 查询
  if (!tier1ReportId) {
    return new Response(JSON.stringify({ error: "缺少 tier1ReportId 或 tier2Id" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  let row = await env.DB.prepare(
    `SELECT id, generation_status, content, source_tier1_report_id, updated_at FROM reports_tier2 WHERE source_tier1_report_id = ? AND user_id = ? LIMIT 1`
  ).bind(tier1ReportId, user.userId).first<any>();

  if (row) {
    // 卡死保护：同 tier2Id 路径
    if (row.generation_status === "processing") {
      const now = Math.floor(Date.now() / 1000);
      const lastUpdate = row.updated_at ?? row.created_at;
      if (now - lastUpdate > PROCESSING_STALE_THRESHOLD_SEC) {
        console.warn(`[tier2/status] Stale processing record ${row.id} (stuck ${now - lastUpdate}s), resetting to pending`);
        await env.DB.prepare(
          `UPDATE reports_tier2 SET generation_status = 'pending', updated_at = ? WHERE id = ?`
        ).bind(now, row.id).run();
        row = { ...row, generation_status: "pending" };
      }
    }

    if (row.generation_status === "pending" && row.content === JSON.stringify({status:"pending"})) {
      const tier1Row = await env.DB.prepare(`SELECT report_data FROM reports_tier1 WHERE id = ?`).bind(row.source_tier1_report_id).first<any>();
      if (tier1Row) { try {
        const tier1Report = JSON.parse(tier1Row.report_data) as Record<string, unknown>;
        const now = Math.floor(Date.now() / 1000);
        await env.DB.prepare(`UPDATE reports_tier2 SET generation_status = 'processing', updated_at = ? WHERE id = ?`).bind(now, row.id).run();
        context.waitUntil(generateTier2Async(tier1Report, row.id, env));
        return new Response(JSON.stringify({ generationStatus: "processing", tier2ReportId: row.id }), { headers: { "Content-Type": "application/json" } });
      } catch { /* JSON parse failed */ } }
    }

    const result = { generationStatus: row.generation_status, tier2ReportId: row.id };
    if (row.generation_status === "ready" && row.content) { try { result.content = JSON.parse(row.content); } catch { result.content = null; } }
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ generationStatus: "not_found" }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestGet = async (...args) => { return (GET)(...args); };

async function generateTier2Async(tier1Report, tier2Id, env) {
  try {
    const tier2Content = await callDeepSeekTier2(tier1Report, env);
    const now = Math.floor(Date.now() / 1000);
    if (tier2Content) {
      await env.DB.prepare(`UPDATE reports_tier2 SET content = ?, generation_status = 'ready', updated_at = ? WHERE id = ?`).bind(JSON.stringify(tier2Content), now, tier2Id).run();
      console.log(`[tier2/status] Auto-triggered generation succeeded for ${tier2Id}`);
    } else {
      await env.DB.prepare(`UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`).bind(now, tier2Id).run();
      console.error(`[tier2/status] Auto-triggered generation failed for ${tier2Id}`);
    }
  } catch (e) { console.error(`[tier2/status] Auto-trigger exception for ${tier2Id}:`, e); }
}
