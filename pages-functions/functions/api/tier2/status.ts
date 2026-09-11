import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, beijingDate } from "../../_utils";
import { advanceTier2Stage, readTier2Progress } from "../_tier2_stages";
import type { Ctx } from "../../_utils";

// GET /api/tier2/status?tier1ReportId=xxx 或 ?tier2Id=xxx
// 不传 tier1ReportId 时回退查询该用户最新的 tier2 记录（支持独立进阶报告）
export const GET = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  // 当日次数（成功完成才计入）：告知前端是否还能生成进阶报告
  const _today = beijingDate();
  const _usage = await env.DB.prepare(`SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`).bind(user.userId, _today).first<any>();
  const canGenerate = !(_usage && _usage.used_count >= 1);

  // 孤儿任务兜底：后台生成任务可能被平台回收，processing 卡死；超过 5 分钟视为 failed（前端可重新触发）
  const effectiveStatus = (row: any): string => {
    if (row.generation_status === "processing" && row.updated_at && Math.floor(Date.now() / 1000) - row.updated_at > 300) {
      return "failed";
    }
    return row.generation_status;
  };

  const buildResult = (row: any) => {
    const generationStatus = effectiveStatus(row);
    const result: Record<string, unknown> = {
      generationStatus,
      tier2ReportId: row.id,
      unlocked: !!row.unlock_method,
      updatedAt: row.updated_at ?? null,
      unlockMethod: row.unlock_method ?? null,
      sourceTier1ReportId: row.source_tier1_report_id ?? null,
      facePhotoKey: row.face_photo_key ?? null,
      canGenerate,
    };
    if (generationStatus === "ready" && row.content) {
      try { result.content = JSON.parse(row.content); } catch { result.content = null; }
    }
    return result;
  };

  // face_photo_key 列在 0022 迁移中新增；未迁移环境自动回退，避免整页 500
  const FULL_COLS = `id, generation_status, content, source_tier1_report_id, unlock_method, face_photo_key, updated_at`;
  const LEGACY_COLS = `id, generation_status, content, source_tier1_report_id, unlock_method, updated_at`;
  const selectRow = async (where: string, bind: unknown[]) => {
    try {
      return await env.DB.prepare(`SELECT ${FULL_COLS} FROM reports_tier2 WHERE ${where} LIMIT 1`).bind(...bind).first<any>();
    } catch (e) {
      console.warn("[tier2/status] face_photo_key missing, legacy columns:", e);
      return await env.DB.prepare(`SELECT ${LEGACY_COLS} FROM reports_tier2 WHERE ${where} LIMIT 1`).bind(...bind).first<any>();
    }
  };

  const url = new URL(request.url);
  const tier1ReportId = url.searchParams.get("tier1ReportId");
  const tier2Id = url.searchParams.get("tier2Id");
  if (tier2Id) {
    let row = await selectRow("id = ? AND user_id = ?", [tier2Id, user.userId]);
    if (!row) {
      return new Response(JSON.stringify({ error: "报告不存在或无权访问" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    // 分阶段生成：processing 且有 _gen 进度时，本次轮询推进一个阶段（单阶段 ≤25s，安全落在 30s 请求预算内）
    // 阶段推进会刷新 updated_at，5 分钟孤儿看门狗不会误判；旧数据（无 _gen 进度）不受影响
    if (row.generation_status === "processing" && readTier2Progress(row)) {
      const nowSec = Math.floor(Date.now() / 1000);
      const stageDue = !row.updated_at || nowSec - row.updated_at >= 5;
      if (stageDue) {
        const adv = await advanceTier2Stage(env, tier2Id);
        if (adv.advanced) row = (await selectRow("id = ? AND user_id = ?", [tier2Id, user.userId])) || row;
      }
    }
    return new Response(JSON.stringify(buildResult(row)), { headers: { "Content-Type": "application/json" } });
  }
  // tier1ReportId is optional - if missing, query by user_id to find latest tier2
  let row: any = null;
  if (tier1ReportId) {
    row = await selectRow("source_tier1_report_id = ? AND user_id = ?", [tier1ReportId, user.userId]);
  }
  if (!row) {
    // Fallback: find latest tier2 record for this user (supports standalone tier2)
    row = await selectRow("user_id = ? ORDER BY created_at DESC", [user.userId]);
  }
  if (row) {
    return new Response(JSON.stringify(buildResult(row)), { headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ generationStatus: "not_found", canGenerate }), { headers: { "Content-Type": "application/json" } });
};
export const onRequestGet = async (...args) => { return (GET as any)(...args); };
