import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";
import { initTier2Progress, mergeTier1FaceAnalysis } from "../_tier2_stages";
import type { Ctx } from "../../_utils";

// POST /api/tier2/generate
// 关联初识报告的进阶报告生成：立即返回 processing，生成由分阶段引擎（_tier2_stages.ts）完成
// —— /tier2/status?tier2Id=... 轮询每次推进一个阶段；scheduled-worker 每分钟兜底。
// （平台单次请求总执行时长约 30s，旧的"请求内一次性 AI 生成 + waitUntil"方案会被平台回收，
//  导致记录永远卡在 processing；分阶段后每阶段 ≤25s，可安全落在请求预算内。）
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
  const tier2Row = await env.DB.prepare(
    `SELECT id, generation_status, content, source_tier1_report_id
     FROM reports_tier2 WHERE id = ? AND user_id = ? LIMIT 1`
  )
    .bind(reportId, user.userId)
    .first<any>();

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
      // content 损坏，重新生成
    }
  }

  // 3. 独立报告（不关联初识报告）不能从空数据生成：
  // 让前端回到"上传照片"入口（/tier2/generate-standalone），避免无数据空生成
  if (!tier2Row.source_tier1_report_id) {
    return new Response(
      JSON.stringify({ error: "standalone_report", message: "该进阶报告需要上传照片后生成" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. 查 tier1 报告内容（面部特征数据源）
  let tier1Report: Record<string, unknown> = {};
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = ? LIMIT 1`
  )
    .bind(tier2Row.source_tier1_report_id)
    .first<any>();
  if (tier1Row) {
    try {
      tier1Report = JSON.parse(tier1Row.report_data) as Record<string, unknown>;
    } catch {
      console.warn("[tier2/generate] tier1 report data parse failed, using empty report");
    }
  }

  // 5. 置为 processing 并写初始进度（从 step1 开始；面部特征取自初识报告，缺失字段用默认值兜底）
  await initTier2Progress(env, tier2Row.id, {
    standalone: false,
    faceAnalysis: mergeTier1FaceAnalysis(tier1Report),
  });

  return new Response(JSON.stringify({ id: tier2Row.id, generationStatus: "processing" }), {
    headers: { "Content-Type": "application/json" },
  });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
