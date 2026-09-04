import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId, beijingDate, parseDeepseekJson } from "../../_utils";
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

  // 查询今日已生成 tier1 次数（北京时间）
  const today = beijingDate();
  const todayStartUnix = Math.floor(new Date(today + "T00:00:00+08:00").getTime() / 1000);
  const todayEndUnix = todayStartUnix + 24 * 60 * 60;
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM reports_tier1 WHERE user_id = ? AND created_at >= ? AND created_at < ?`
  ).bind(authUser.userId, todayStartUnix, todayEndUnix).first<any>();
  const todayCount = countResult?.cnt ?? 0;
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

  // ===== 新增：人脸数量前置校验 =====
  // 用 qwen-vl-max 快速判断图片中人脸数量，只有恰好1张才允许进入详细分析
  // 此步骤不消耗每日分析次数额度
  let faceCount = -1;
  let faceCheckReason = "";
  if (photoBase64) {
    const apiKey = env.DASHSCOPE_API_KEY;
    // [DIAG] 打印密钥状态（不打印明文，只打印长度）
    console.log(`[DIAG] DASHSCOPE_API_KEY present: ${!!apiKey}, key length: ${apiKey?.length ?? 0}`);
    if (apiKey) {
      const faceCheckPrompt = `Count the number of clearly visible human faces in this image. Reply with ONLY a single integer (e.g. 0, 1, 2, 3...). Do not write any other text.`;
      const requestBody = JSON.stringify({
        model: "qwen-vl-max",
        messages: [{ role: "user", content: [{ type: "text", text: faceCheckPrompt }, { type: "image_url", image_url: { url: photoBase64 } }] }],
        max_tokens: 10,
        temperature: 0,
      });
      // [DIAG] 打印请求参数摘要
      console.log(`[DIAG] API endpoint: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`);
      console.log(`[DIAG] Model: qwen-vl-max, photoBase64 length: ${photoBase64.length}, request body length: ${requestBody.length}`);
      try {
        console.log(`[DIAG] Sending face check request...`);
        const faceCheckResp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: requestBody,
          signal: AbortSignal.timeout(15000),
        });
        // [DIAG] 打印HTTP状态码和关键字段
        console.log(`[DIAG] Face check response status: ${faceCheckResp.status} ${faceCheckResp.statusText}`);
        console.log(`[DIAG] Response headers (filtered): contentType=${faceCheckResp.headers.get("content-type")}, x-RequestId=${faceCheckResp.headers.get("x-RequestId")}, x-dashscope-trace-id=${faceCheckResp.headers.get("x-dashscope-trace-id")}`);
        const respText = await faceCheckResp.text();
        console.log(`[DIAG] Face check response body (${respText.length} chars): ${respText.slice(0, 800)}`);
        if (faceCheckResp.ok) {
          const faceData: any = JSON.parse(respText);
          const faceText = faceData?.choices?.[0]?.message?.content?.trim() ?? "";
          const parsed = parseInt(faceText, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            faceCount = parsed;
            console.log(`[tier1/analyze] Face count check: ${faceCount} face(s) detected`);
          } else {
            // parse failed, leave faceCount=-1 to block
          }
        } else {
          // [DIAG] 解析并打印具体的错误信息（非2xx时重点输出）
          let errMsg = respText;
          try { errMsg = JSON.stringify(JSON.parse(respText)); } catch {}
          console.error(`[DIAG] Face check API error ${faceCheckResp.status}: ${errMsg}`);
          let apiError = "";
          try {
            const errJson = JSON.parse(respText);
            apiError = errJson?.error?.message ?? errJson?.message ?? String(faceCheckResp.status);
          } catch {}
          faceCheckReason = "AI服务返回错误（" + (apiError || String(faceCheckResp.status)) + "）";
        }
      } catch (e: any) {
        // [DIAG] 打印异常详情（timeout/cancelled/network等）
        console.error(`[DIAG] Face check exception: name=${e?.name}, message=${e?.message}, cause=${e?.cause?.toString?.()}`);
        const typeName = e?.name || "Unknown";
        if (typeName === "TimeoutError") faceCheckReason = "网络超时，请检查网络后重试";
        else if (typeName === "AbortError") faceCheckReason = "请求已取消，请重试";
        else faceCheckReason = "网络异常（" + typeName + "），请稍后重试";
      }
    } else {
      faceCheckReason = "API密钥未配置，请联系管理员";
    }
  } else {
    console.warn("[DIAG] photoBase64 is null/empty, skipping face check entirely");
  }

  // 人脸数量不合法 → 拦截，不进入分析流程，不消耗每日次数
  if (faceCount === 0) {
    return new Response(
      JSON.stringify({ error: "no_face_detected", message: "未检测到人脸，请上传清晰的正脸照片" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (faceCount >= 2) {
    return new Response(
      JSON.stringify({ error: "multiple_faces", message: "检测到多张人脸，请上传仅包含您本人的照片" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  // faceCount === -1 表示校验步骤失败，拦截并提示用户重试
  // faceCount === 1 表示通过校验，继续正常流程
  if (faceCount === -1) {
    console.warn("[tier1/analyze] Face count check failed, blocking analysis");
    return new Response(
      JSON.stringify({ error: "face_check_failed", message: faceCheckReason || "人脸校验服务异常，请重试" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
  if (faceCount === 1) {
    console.log("[tier1/analyze] Face count validated: exactly 1 face, proceeding to analysis");
  }
  // ===== 人脸校验结束 =====

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
        if (textDesc) console.log(`[tier1/analyze] Vision OK, desc len: ${textDesc.length}, preview: ${textDesc.slice(0, 80)}`);
      } else {
        const errBody = await resp.text().catch(() => "");
        let errMsg = errBody;
        try { errMsg = JSON.stringify(JSON.parse(errBody)); } catch {}
        console.error(`[tier1/analyze] DashScope vision error ${resp.status}: ${errMsg.slice(0, 500)}`);
        let visionError = "";
        try {
          const vErr = JSON.parse(errBody);
          visionError = vErr?.error?.message ?? "AI分析服务异常（" + resp.status + "）";
        } catch {
          visionError = "AI分析服务异常（" + resp.status + "）";
        }
        return new Response(
          JSON.stringify({ error: "vision_error", message: "面部识别失败：" + visionError }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  const saveReport = async (reportData: Record<string, unknown>) => {
    const fullData = { ...reportData, facePhotoKey };
    await env.DB.prepare(
      `INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES (?, ?, ?, ?)`
    ).bind(reportId, authUser.userId, JSON.stringify(fullData), now).run();
  };

  if (!textDesc) {
    console.warn("[tier1/analyze] No vision description, falling back to placeholder report");
    const ph = { faceShape:"圆脸", skinType:"混合肌", eyebrowShape:"一字眉", eyeShape:"杏眼", threeFiveRatio:"比例均衡型", symmetry:"高对称度", personaTags:"温柔知性风", highlight:"你的五官比例很有辨识度，属于耐看型", suggestions:["建议尝试橘色系妆容提气色"] };
    await saveReport(ph);
    return new Response(JSON.stringify({ report: ph, reportId }), { headers: { "Content-Type": "application/json" } });
  }

  // 调用 DeepSeek 生成结构化报告（含 highlight 和 suggestions）
  const dsApiKey = env.DEEPSEEK_API_KEY;
  let report: Record<string, unknown> = {};
  if (dsApiKey) {
    const prompt = `You are a professional beauty consultant. Based on the following face description, select exactly one option from each category and provide personalized advice.

[Face Description]
${textDesc}

faceShape: 鹅蛋脸, 圆脸, 方脸, 长脸, 心形脸, 菱形脸, 梨形脸
skinType: 干性, 油性, 混合肌, 中性, 敏感肌
eyebrowShape: 一字眉, 柳叶眉, 剑眉, 弯眉, 平眉, 粗眉, 细眉
eyeShape: 杏眼, 丹凤眼, 圆眼, 桃花眼, 狐狸眼, 下垂眼, 深邃眼
threeFiveRatio: 比例均衡型, 上庭偏长型, 中庭偏长型, 下庭偏长型, 五眼偏宽型, 五眼偏窄型
symmetry: 高对称度, 中等对称度, 自然不对称（带个性）
personaTags: 温柔知性风, 元气少女风, 高级冷艳风, 邻家甜美风, 飒爽英气风, 复古文艺风, 清冷仙气风, 辣妹活力风

Output strict JSON only, with these exact keys:
{
  "faceShape": "one of the options above",
  "skinType": "one of the options above",
  "eyebrowShape": "one of the options above",
  "eyeShape": "one of the options above",
  "threeFiveRatio": "one of the options above",
  "symmetry": "one of the options above",
  "personaTags": "one of the options above",
  "highlight": "A one-sentence catchy compliment that highlights the user's most distinctive beauty feature, written in natural Chinese. Keep it warm and personal, around 10-20 Chinese characters.",
  "suggestions": ["3-5 specific, actionable makeup or skincare tips in Chinese, each around 10-20 characters. Make them tailored to the identified features."]
}`;
    console.log(`[tier1/analyze] Calling DeepSeek with desc len: ${textDesc.length}`);
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${dsApiKey}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], max_tokens: 500, temperature: 0.3 }),
      signal: AbortSignal.timeout(20000),
    });
    if (resp.ok) {
      const data: any = await resp.json();
      const raw = data?.choices?.[0]?.message?.content;
      if (raw) {
        const parsed = parseDeepseekJson(raw);
        if (parsed) {
          Object.assign(report, parsed);
          console.log(`[tier1/analyze] DeepSeek OK, parsed report keys: ${Object.keys(report).join(", ")}, highlight=${String(report.highlight)?.slice(0, 40)}, suggestions count=${Array.isArray(report.suggestions) ? report.suggestions.length : 0}`);
        } else {
          console.error("[tier1/analyze] Invalid DeepSeek JSON response");
        }
      } else {
        console.error("[tier1/analyze] DeepSeek response has no content in choices[0].message");
      }
    } else {
      const errBody = await resp.text().catch(() => "");
      console.error(`[tier1/analyze] DeepSeek error ${resp.status}: ${errBody.slice(0, 300)}`);
      let dsError = "";
      try {
        const dErr = JSON.parse(errBody);
        dsError = dErr?.error?.message ?? "AI报告生成异常（" + resp.status + "）";
      } catch {
        dsError = "AI报告生成异常（" + resp.status + "）";
      }
      return new Response(
        JSON.stringify({ error: "deepseek_error", message: "报告生成失败：" + dsError }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
  } else {
    console.warn("[tier1/analyze] DEEPSEEK_API_KEY not set, skipping DeepSeek call");
    return new Response(
      JSON.stringify({ error: "config_error", message: "报告生成服务未配置，请联系管理员" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fallback defaults for any missing enum fields from DeepSeek
  const defaults = { faceShape:"圆脸", skinType:"混合肌", eyebrowShape:"一字眉", eyeShape:"杏眼", threeFiveRatio:"比例均衡型", symmetry:"高对称度", personaTags:"温柔知性风" };
  for (const [k, v] of Object.entries(defaults)) {
    if (!report[k]) report[k] = v;
  }

  // highlight: prefer DeepSeek output, fall back to a gentle default
  if (!report.highlight) {
    report.highlight = "你的五官比例很有辨识度，属于耐看型";
    console.log("[tier1/analyze] highlight missing from DeepSeek, using default");
  }

  // suggestions: prefer DeepSeek output, build from report features as fallback
  if (Array.isArray(report.suggestions) && report.suggestions.length > 0) {
    console.log(`[tier1/analyze] suggestions from DeepSeek: ${report.suggestions.length} items`);
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
    console.log(`[tier1/analyze] suggestions from fallback rules: ${fallbackSuggestions.length} items`);
  }

  await saveReport(report);
  return new Response(JSON.stringify({ report, reportId }), { headers: { "Content-Type": "application/json" } });
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
