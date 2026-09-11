import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, beijingDate, generateId } from "../../_utils";
import { resizeBase64IfNeeded } from "../../_image_utils";
import { initTier2Progress } from "../_tier2_stages";
import type { Ctx } from "../../_utils";

// POST /api/tier2/generate-standalone
// 独立生成进阶报告：接收用户上传的正面照片，自行完成面部分析 + AI 生成（不依赖初识报告）。
// 请求侧只做轻量工作：人脸数量预校验（≤12s）+ 照片存 R2 + 写初始进度，立即返回。
// 主生成（视觉分析 + 六步妆容 + 商品补全）由分阶段引擎（_tier2_stages.ts）完成：
//   - /tier2/status?tier2Id=... 的轮询每次推进一个阶段（用户在看页面时约 2-4 分钟完成）
//   - scheduled-worker 每分钟兜底推进（用户离开页面后最终也能完成）
// 原因：平台对单次请求的总执行时长限制约 30s，一次性完整生成（60-150s）永远无法在请求内完成。
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  // 1. 解析 multipart 表单：photo（照片文件）+ tier2ReportId（可选；独立生成缺省时自动创建当日记录）
  const form = await request.formData().catch(() => null);
  let tier2ReportId = (form?.get("tier2ReportId") as string | null) || undefined;

  // 1.1 当日次数检查：次数在分析「成功完成」时计入；此处仅拦截当日名额已用完的重复生成
  const today = beijingDate();
  const MAX_DAILY = 1;
  const usageRow = await env.DB.prepare(
    `SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  ).bind(user.userId, today).first<any>();
  if (usageRow && usageRow.used_count >= MAX_DAILY) {
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "今日进阶报告次数已用完，明天再来吧" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // 1.2 独立生成：缺省报告记录时自动创建当日新记录（不再要求先「看广告解锁」）
  if (!tier2ReportId) {
    const now = Math.floor(Date.now() / 1000);
    tier2ReportId = generateId();
    await env.DB.prepare(
      `INSERT INTO reports_tier2 (id, user_id, source_tier1_report_id, generation_status, content, unlock_method, created_at)
       VALUES (?, ?, NULL, 'pending', '{"status":"pending"}', 'direct', ?)`
    ).bind(tier2ReportId, user.userId, now).run();
  }

  // 2. 校验记录归属与状态（pending/failed/ready 可生成；processing 需卡死超 5 分钟才允许重新生成）
  const row = await env.DB.prepare(
    `SELECT id, user_id, generation_status, updated_at FROM reports_tier2 WHERE id = ? AND user_id = ? LIMIT 1`
  ).bind(tier2ReportId, user.userId).first<any>();
  if (!row) {
    return new Response(
      JSON.stringify({ error: "not_found", message: "报告不存在，请重新解锁" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  const nowSec = Math.floor(Date.now() / 1000);
  const isStaleProcessing =
    row.generation_status === "processing" && (!row.updated_at || nowSec - row.updated_at > 300);
  if (!["pending", "failed", "ready"].includes(row.generation_status) && !isStaleProcessing) {
    return new Response(
      JSON.stringify({ error: "in_progress", message: "报告正在生成中，请稍候" }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const file = form?.get("photo") as File | null;
  if (!file) {
    return new Response(JSON.stringify({ error: "缺少照片" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  let photoBase64: string | undefined;
  try {
    const buf = await file.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) {
      bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
    }
    photoBase64 = `data:${file.type || "image/jpeg"};base64,${btoa(bin)}`;
    photoBase64 = await resizeBase64IfNeeded(photoBase64, 2048);
  } catch (e) {
    console.error("[tier2/standalone] photo read failed:", e);
    return new Response(JSON.stringify({ error: "照片读取失败，请重新上传" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (!photoBase64) {
    return new Response(JSON.stringify({ error: "缺少照片" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // 3. 上传照片到 R2（视觉分析阶段与后续妆效图复用）
  let facePhotoKey: string | null = null;
  try {
    facePhotoKey = `face-photos/${user.userId}/tier2-${tier2ReportId}.jpg`;
    const commaIdx = photoBase64.indexOf(",");
    const rawB64 = photoBase64.slice(commaIdx + 1);
    const binaryStr = Array.from(atob(rawB64), (c) => c.charCodeAt(0));
    const blob = new Blob([new Uint8Array(binaryStr)], { type: "image/jpeg" });
    await env.R2_TEMP.put(facePhotoKey, blob.stream(), { httpMetadata: { contentType: "image/jpeg" } });
  } catch (e) {
    console.error("[tier2/standalone] R2 upload failed:", e);
  }

  // 4. 人脸数量前置校验（≤12s）：只有明确数出 0 张/多张才拒绝；服务失败或未配置则放行
  const dsApiKey = env.DASHSCOPE_API_KEY;
  if (dsApiKey) {
    const faceCheckPrompt = `Count the number of clearly visible human faces in this image. Reply with ONLY a single integer (e.g. 0, 1, 2, 3...). Do not write any other text.`;
    let faceCount: number | null = null;
    try {
      const faceCheckResp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${dsApiKey}` },
        body: JSON.stringify({ model: "qwen-vl-max", messages: [{ role: "user", content: [{ type: "text", text: faceCheckPrompt }, { type: "image_url", image_url: { url: photoBase64 } }] }], max_tokens: 10, temperature: 0 }),
        signal: AbortSignal.timeout(12000),
      });
      if (faceCheckResp.ok) {
        const faceText = (await faceCheckResp.json().catch(() => ({}))).choices?.[0]?.message?.content?.trim() ?? "";
        faceCount = parseInt(faceText, 10);
      } else {
        console.warn("[tier2/standalone] face check service error:", faceCheckResp.status);
      }
    } catch (e) {
      console.warn("[tier2/standalone] face check timeout/exception:", e);
    }
    if (faceCount !== null && faceCount !== 1) {
      return new Response(JSON.stringify({ error: "face_check_failed", message: "请上传一张清晰的人脸照片" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }
  // 5. 写初始进度并置为 processing：分阶段生成由 /tier2/status 轮询 + scheduled-worker 驱动
  await initTier2Progress(env, tier2ReportId, { standalone: true, facePhotoKey });

  return new Response(
    JSON.stringify({ tier2ReportId, generationStatus: "processing" }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
