import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId, beijingDate, parseDeepseekJson, getChatProviderConfig, callChatProvider } from "../../_utils";
import { resizeBase64IfNeeded } from "../../_image_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier1/analyze
// 接收用户上传的正面照片，先校验人脸数量，再调用 DashScope Qwen-VL 分析面部特征，再用 DeepSeek 生成结构化报告
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const authUser = await requireAuth(request, env);
  if (!authUser) {
    return new Response(JSON.stringify({ error: "未授权" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  // 查询今日已生成 tier1 次数（北京时间）— 使用独立计数器表，与报告覆盖模式解耦
  const today = beijingDate();
  const countResult = await env.DB.prepare(
    `SELECT used_count FROM tier1_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  ).bind(authUser.userId, today).first<any>();
  const todayCount = countResult?.used_count ?? 0;
  if (todayCount >= 2) {
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "今日初识次数已用完，明天再来吧" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // 解析 multipart 表单中的照片
  let photoBase64: string | undefined;
  if (request.headers.get("content-type")?.includes("multipart")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("photo") as File | null;
    if (file) {
      const buf = await file.arrayBuffer();
      const b64 = btoa(Array.from(new Uint8Array(buf), byte => String.fromCharCode(byte)).join(""));
      photoBase64 = `data:${file.type || "image/jpeg"};base64,${b64}`;
      // 兜底：确保图片尺寸满足 DashScope 要求（512-4096px），长边限制 2048px
      photoBase64 = await resizeBase64IfNeeded(photoBase64, 2048);
    }
  }
  // 关键性兜底
  if (photoBase64 && photoBase64.length > 1_500_000) {
    console.warn(`[tier1/analyze] photoBase64 too large (${photoBase64.length} chars), forcing resize to 1024px`);
    photoBase64 = await resizeBase64IfNeeded(photoBase64, 1024);
    console.log(`[tier1/analyze] After forced resize: ${photoBase64.length} chars`);
  }

  const now = Math.floor(Date.now() / 1000);
  const reportId = generateId();

  // 将照片上传到 R2_TEMP，key 格式：face-photos/{userId}/{reportId}.jpg
  let facePhotoKey: string | null = null;
  if (photoBase64) {
    try {
      facePhotoKey = `face-photos/${authUser.userId}/${reportId}.jpg`;
      const commaIdx = photoBase64.indexOf(",");
      const rawB64 = commaIdx >= 0 ? photoBase64.slice(commaIdx + 1) : photoBase64;
      const binaryStr = Array.from(atob(rawB64), c => c.charCodeAt(0));
      const blob = new Blob([new Uint8Array(binaryStr)], { type: "image/jpeg" });
      await env.R2_TEMP.put(facePhotoKey, blob.stream(), { httpMetadata: { contentType: "image/jpeg" } });
      console.log(`[tier1/analyze] Face photo uploaded to R2: ${facePhotoKey}`);
    } catch (e) {
      console.error("[tier1/analyze] R2 upload failed, continuing without photo reference:", e);
      facePhotoKey = null;
    }
  }

  // ===== 人脸数量前置校验 =====
  let faceCount = -1;
  let faceCheckReason = "";
  if (photoBase64) {
    const apiKey = env.DASHSCOPE_API_KEY;
    if (apiKey) {
      const faceCheckPrompt = `Count the number of clearly visible human faces in this image. Reply with ONLY a single integer (e.g. 0, 1, 2, 3...). Do not write any other text.`;
      const requestBody = JSON.stringify({
        model: "qwen-vl-max",
        messages: [{ role: "user", content: [{ type: "text", text: faceCheckPrompt }, { type: "image_url", image_url: { url: photoBase64 } }] }],
        max_tokens: 10,
        temperature: 0,
      });
      try {
        const faceCheckResp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: requestBody,
          signal: AbortSignal.timeout(15000),
        });
        if (faceCheckResp.ok) {
          const faceData: any = JSON.parse(await faceCheckResp.text());
          const faceText = faceData?.choices?.[0]?.message?.content?.trim() ?? "";
          faceCount = parseInt(faceText, 10);
        } else {
          faceCount = -1;
          faceCheckReason = "人脸校验服务异常，请重试";
        }
      } catch (e: any) {
        faceCount = -1;
        faceCheckReason = e?.name === "TimeoutError" ? "网络超时，请检查网络后重试" : "网络异常，请稍后重试";
      }
    } else {
      faceCheckReason = "API密钥未配置，请联系管理员";
    }
  }

  // 人脸数量不合法 → 拦截
  if (faceCount === 0) {
    return new Response(JSON.stringify({ error: "no_face_detected", message: "未检测到人脸，请上传清晰的正脸照片" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (faceCount >= 2) {
    return new Response(JSON.stringify({ error: "multiple_faces", message: "检测到多张人脸，请上传仅包含您本人的照片" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (faceCount === -1) {
    console.warn("[tier1/analyze] Face count check failed, blocking analysis");
    return new Response(JSON.stringify({ error: "face_check_failed", message: faceCheckReason || "人脸校验服务异常，请重试" }), { status: 503, headers: { "Content-Type": "application/json" } });
  }

  // 调用 vision model 分析面部特征
  let textDesc = "";
  if (photoBase64) {
    const apiKey = env.DASHSCOPE_API_KEY;
    if (apiKey) {
      const visionPrompt = `Please observe this front-facing face photo and describe these visual features in Chinese natural language (no enum labels): face shape contour, eyebrow shape/density, eye morphology, skin condition, three-court proportions, facial symmetry. One paragraph per feature.`;
      const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "qwen-vl-max", messages: [{ role: "user", content: [{ type: "text", text: visionPrompt }, { type: "image_url", image_url: { url: photoBase64 } }] }], max_tokens: 500, temperature: 0.3 }),
        signal: AbortSignal.timeout(20000),
      });
      if (resp.ok) {
        const data: any = await resp.json();
        textDesc = data?.choices?.[0]?.message?.content?.trim() ?? "";
      } else {
        const errBody = await resp.text().catch(() => "");
        let visionError = "";
        try { visionError = JSON.parse(errBody)?.error?.message ?? "AI分析服务异常（" + resp.status + "）"; } catch { visionError = "AI分析服务异常（" + resp.status + "）"; }
        return new Response(JSON.stringify({ error: "vision_error", message: "面部识别失败：" + visionError }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
    }
  }

  const saveReport = async (reportData: Record<string, unknown>) => {
    const fullData = { ...reportData, facePhotoKey };
    // 三步一起提交：删旧报告 → 写新报告 → 计数器+1，任一失败整体回滚，避免额度与报告不同步
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM reports_tier1 WHERE user_id = ?`).bind(authUser.userId),
      env.DB.prepare(
        `INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES (?, ?, ?, ?)`
      ).bind(reportId, authUser.userId, JSON.stringify(fullData), now),
      env.DB.prepare(
        `INSERT INTO tier1_daily_usage (user_id, usage_date, used_count) VALUES (?, ?, 1)
         ON CONFLICT(user_id, usage_date) DO UPDATE SET used_count = used_count + 1`
      ).bind(authUser.userId, today),
    ]);
  };

  if (!textDesc) {
    console.warn("[tier1/analyze] No vision description, falling back to placeholder report");
    const ph = { faceShape:"圆脸", skinType:"混合肌", eyebrowShape:"一字眉", eyeShape:"杏眼", threeFiveRatio:"比例均衡型", symmetry:"高对称度", personaTags:"温柔知性风", highlight:"你的五官比例很有辨识度，属于耐看型", suggestions:["建议尝试橘色系妆容提气色"] };
    await saveReport(ph);
    return new Response(JSON.stringify({ report: ph, reportId }), { headers: { "Content-Type": "application/json" } });
  }

  // 生成结构化报告：按后台 text_model_provider 选择 Agnes/DeepSeek，失败回退 DeepSeek
  const prompt = `You are a professional beauty consultant. Based on the following face description, select exactly one option from each category and provide personalized advice.

[Face Description]
${textDesc}

faceShape: 鹅蛋脸, 圆脸, 方脸, 长脸, 菱形脸, 心形脸, 倒三角脸
skinType: 干性肌, 油性肌, 混合肌, 中性肌, 敏感肌
eyebrowShape: 标准眉, 柳叶眉, 挑眉, 平眉, 一字眉, 拱形眉, 细眉
eyeShape: 丹凤眼, 桃花眼, 圆眼, 凤眼, 杏眼, 下垂眼, 瑞凤眼
threeFiveRatio: 三庭均衡型, 上庭偏长型, 中庭偏长型, 下庭偏长型, 上庭偏短型, 下庭偏短型
symmetry: 高对称度, 中等对称度, 自然微不对称, 明显不对称
personaTags: 温柔知性风, 元气少女风, 干练商务风, 韩系清新风, 熟龄优雅风, 个性酷飒风, 甜美可爱风, 清冷气质风

Output strict JSON only, with these exact keys:
{
  "faceShape": "one of the options above",
  "skinType": "one of the options above",
  "eyebrowShape": "one of the options above",
  "eyeShape": "one of the options above",
  "threeFiveRatio": "one of the options above",
  "symmetry": "one of the options above",
  "personaTags": "one of the options above",
  "highlight": "A one-sentence catchy compliment in Chinese, 10-20 characters",
  "suggestions": ["3-5 makeup tips in Chinese"]
}`;

  let cfg = await getChatProviderConfig(env);
  let raw = cfg.apiKey ? await callChatProvider(cfg, prompt, { maxTokens: 500, temperature: 0.3 }, "[tier1/analyze] (" + cfg.model + ")") : null;
  let parsed = raw ? parseDeepseekJson(raw) : null;
  if (!parsed) {
    // 配置供应商失败 → 回退 DeepSeek
    const dsApiKey = env.DEEPSEEK_API_KEY;
    if (dsApiKey && !(cfg.apiKey && cfg.model === "deepseek-chat")) {
      try {
        const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + dsApiKey },
          body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], max_tokens: 500, temperature: 0.3 }),
          signal: AbortSignal.timeout(20000),
        });
        if (resp.ok) {
          const data: any = await resp.json();
          parsed = parseDeepseekJson(data?.choices?.[0]?.message?.content) || null;
        } else {
          const errBody = await resp.text().catch(() => "");
          let dsError = "";
          try { dsError = JSON.parse(errBody)?.error?.message ?? "AI报告生成异常（" + resp.status + "）"; } catch { dsError = "AI报告生成异常（" + resp.status + "）"; }
          return new Response(JSON.stringify({ error: "deepseek_error", message: "报告生成失败：" + dsError }), { status: 503, headers: { "Content-Type": "application/json" } });
        }
      } catch (e) {
        console.warn("[tier1/analyze] DeepSeek fallback exception:", e);
      }
    }
  }
  if (!parsed && !(cfg.apiKey || env.DEEPSEEK_API_KEY)) {
    console.warn("[tier1/analyze] no LLM key configured");
    return new Response(JSON.stringify({ error: "config_error", message: "报告生成服务未配置，请联系管理员" }), { status: 503, headers: { "Content-Type": "application/json" } });
  }

  const report: Record<string, unknown> = {};
  if (parsed) {
    Object.assign(report, parsed);
  }

  // Fallback defaults
  const defaults = { faceShape:"圆脸", skinType:"混合肌", eyebrowShape:"一字眉", eyeShape:"杏眼", threeFiveRatio:"比例均衡型", symmetry:"高对称度", personaTags:"温柔知性风" };
  for (const [k, v] of Object.entries(defaults)) {
    if (!report[k]) report[k] = v;
  }
  if (!report.highlight) {
    report.highlight = "你的五官比例很有辨识度，属于耐看型";
  }
  if (Array.isArray(report.suggestions) && report.suggestions.length > 0) {
    // keep as-is
  } else {
    const fallbackSuggestions: string[] = [];
    if (report.faceShape === "圆脸") fallbackSuggestions.push("建议尝试略带棱角的眉形拉长脸部视觉比例");
    if (report.skinType === "混合肌") fallbackSuggestions.push("T区控油、U区保湿，分区护理效果更佳");
    if (report.skinType === "干性肌") fallbackSuggestions.push("妆前做好保湿，选择滋润型底妆产品");
    if (report.skinType === "油性肌") fallbackSuggestions.push("定妆是关键，建议选择持妆型粉底和散粉");
    if (report.eyeShape === "丹凤眼") fallbackSuggestions.push("眼线可微微上挑，突出东方韵味");
    if (report.eyeShape === "杏眼") fallbackSuggestions.push("适合温柔系眼妆，大地色系眼影很百搭");
    if (report.eyebrowShape === "一字眉") fallbackSuggestions.push("保持眉形干净，可适当加一点弧度更柔和");
    if (fallbackSuggestions.length === 0) fallbackSuggestions.push("根据你的面部特征，个性化妆容建议正在生成中");
    report.suggestions = fallbackSuggestions;
  }

  await saveReport(report);
  return new Response(JSON.stringify({ report, reportId }), { headers: { "Content-Type": "application/json" } });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
