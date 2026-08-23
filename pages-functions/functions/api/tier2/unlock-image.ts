// TODO [暂缓优化 - 2026-08]: AI妆效图生成效果不理想
// 已尝试: function=description_edit, strength=0.2/0.5 均不满意
//   - strength=0.5: 背景/服装/风格被大幅改变，只保留大致人脸相似度
//   - strength=0.2: 几乎看不出彩妆效果（口红/眼影/腮红均不明显）
// 阿里云 wanx2.1-imageedit 没有专门的虚拟试妆API，只能用通用图像编辑硬凑
// 后续方向：1) 尝试 strength 0.3-0.4 中间值 2) 调研其他厂商专门的美妆试妆模型
// 3) 如果始终效果不佳，可考虑砍掉此功能，tier2仅保留文字建议内容
// 当前功能接口本身工作正常（不会报错），只是视觉效果未达预期，可以先上线跑通率先验证其他部分

import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, beijingDate, generateId } from "../../_utils";
import { resizeBase64IfNeeded } from "../../_image_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier2/unlock-image
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

  const today = beijingDate();

  // 1. 验证归属用户
  const tier2Row = await env.DB.prepare(
    `SELECT id, user_id, share_token FROM reports_tier2 WHERE id = ? LIMIT 1`
  )
    .bind(reportId)
    .first<any>();

  if (!tier2Row || tier2Row.user_id !== user.userId) {
    return new Response(JSON.stringify({ error: "报告不存在或无权访问" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. 检查分享是否已转化
  if (!tier2Row.share_token) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "referral_not_confirmed" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const referralRow = await env.DB.prepare(
    `SELECT converted_user_id FROM share_referrals WHERE token = ? LIMIT 1`
  )
    .bind(tier2Row.share_token)
    .first<any>();

  if (!referralRow || !referralRow.converted_user_id) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "referral_not_confirmed" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. 检查今日使用次数（每日限1次）
  const MAX_DAILY_IMAGES = 1;
  const usageRow = await env.DB.prepare(
    `SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  )
    .bind(user.userId, today)
    .first<any>();

  if (usageRow && usageRow.used_count >= MAX_DAILY_IMAGES) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "daily_limit_exceeded" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. 从 tier1 report_data.facePhotoKey 读取 R2 图片并转为 base64 data URL
  let imageDataUrl: string | null = null;
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = (SELECT source_tier1_report_id FROM reports_tier2 WHERE id = ?) LIMIT 1`
  )
    .bind(reportId)
    .first<any>();

  if (tier1Row?.report_data) {
    try {
      const tier1Report = JSON.parse(tier1Row.report_data) as Record<string, unknown>;
      const facePhotoKey = tier1Report.facePhotoKey as string | null;
      if (facePhotoKey) {
        const obj = await env.R2_TEMP.get(facePhotoKey);
        if (obj && "body" in obj) {
          const arrayBuffer = await obj.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64 = btoa(binary);
          const contentType = obj.httpMetadata?.contentType || "image/jpeg";
          imageDataUrl = `data:${contentType};base64,${base64}`;
          // 兜底：确保图片尺寸满足 DashScope 要求（512-4096px）
          imageDataUrl = await resizeBase64IfNeeded(imageDataUrl, 2048);
          console.log(`[tier2/unlock-image] Read R2 image: ${facePhotoKey}, size: ${arrayBuffer.byteLength} bytes`);
        }
      }
    } catch (e) {
      console.error("[tier2/unlock-image] Failed to read R2 image:", e);
    }
  }

  if (!imageDataUrl) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "no_face_photo", message: "未找到用户原始照片，请重新进行分析" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 5. 从 tier2 content 提取妆容风格描述
  let styleDesc = "清新自然淡妆";
  try {
    const contentRow = await env.DB.prepare(
      `SELECT content FROM reports_tier2 WHERE id = ? LIMIT 1`
    )
      .bind(reportId)
      .first<any>();
    if (contentRow?.content) {
      const content = JSON.parse(contentRow.content) as Record<string, unknown>;
      if (typeof content.style === "string") styleDesc = content.style;
      if (Array.isArray(content.keyAreas) && content.keyAreas.length > 0) {
        styleDesc += "，重点：" + (content.keyAreas as string[]).slice(0, 3).join("、");
      }
    }
  } catch {
    // 忽略
  }

  // 6. 调用 DashScope wanx2.1-imageedit
  const generatedImageUrl = await generateImageWithDashScope(imageDataUrl, styleDesc, env);
  if (!generatedImageUrl) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "ai_generation_failed", retryable: true }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // 7. 下载生成的图片并上传到 R2
  let imageBuffer: ArrayBuffer;
  try {
    const imgResp = await fetch(generatedImageUrl, {
      signal: AbortSignal.timeout(30000),
    });
    if (!imgResp.ok) {
      console.error("[tier2/unlock-image] Failed to download generated image:", imgResp.status);
      return new Response(
        JSON.stringify({ unlocked: false, reason: "image_download_failed", retryable: true }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    imageBuffer = await imgResp.arrayBuffer();
  } catch (e) {
    console.error("[tier2/unlock-image] Image download error:", e);
    return new Response(
      JSON.stringify({ unlocked: false, reason: "image_download_failed", retryable: true }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const r2Key = `tier2-ai/${generateId()}.jpg`;
  console.log(`[tier2/unlock-image] Starting R2 upload, key=${r2Key}, buffer size=${imageBuffer.byteLength} bytes`);
  console.log(`[tier2/unlock-image] R2_TEMP binding type=${typeof env.R2_TEMP}, has put=${typeof env.R2_TEMP?.put}`);
  
  try {
    const putResult = await env.R2_TEMP.put(r2Key, new Uint8Array(imageBuffer), {
      httpMetadata: { contentType: "image/jpeg" },
      // TODO: ai_image_url 对应的 R2 文件需要当天24点清理（scheduled-worker 会处理）
    });
    console.log(`[tier2/unlock-image] R2 upload completed, result=${JSON.stringify(putResult)}`);
    
    // Verify: 立刻读取刚上传的文件确认存在
    const verifyObj = await env.R2_TEMP.get(r2Key);
    console.log(`[tier2/unlock-image] Post-upload verification: obj exists=${!!verifyObj}, hasBody=${verifyObj ? "body" in verifyObj : false}`);
    if (verifyObj && "body" in verifyObj) {
      const verifySize = (await verifyObj.arrayBuffer()).byteLength;
      console.log(`[tier2/unlock-image] Verification: read back ${verifySize} bytes`);
    }
  } catch (e) {
    console.error("[tier2/unlock-image] R2 upload failed:", e);
    return new Response(
      JSON.stringify({ unlocked: false, reason: "storage_failed", retryable: true }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 8. 构建 R2 公开 URL 并更新数据库
  // 使用 r2-proxy 代理访问，避免暴露 R2 公开 URL，同时兼容本地/远程环境
  const r2Url = `/api/r2-proxy?key=${encodeURIComponent(r2Key)}`;
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `UPDATE reports_tier2 SET ai_image_url = ?, updated_at = ? WHERE id = ?`
  )
    .bind(r2Url, now, reportId)
    .run();

  // 9. tier2_daily_usage 计数 +1
  if (!usageRow) {
    await env.DB.prepare(
      `INSERT INTO tier2_daily_usage (user_id, usage_date, used_count) VALUES (?, ?, 1)`
    )
      .bind(user.userId, today)
      .run();
  } else {
    await env.DB.prepare(
      `UPDATE tier2_daily_usage SET used_count = used_count + 1 WHERE user_id = ? AND usage_date = ?`
    )
      .bind(user.userId, today)
      .run();
  }

  return new Response(
    JSON.stringify({ unlocked: true, imageUrl: r2Url }),
    { headers: { "Content-Type": "application/json" } }
  );
};

/**
 * 调用 DashScope wanx2.1-imageedit（description_edit 指令编辑）
 * 端点：/api/v1/services/aigc/image2image/image-synthesis
 */
async function generateImageWithDashScope(imageDataUrl: string, styleDesc: string, env: Ctx["env"]): Promise<string | null> {
  const apiKey = env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.warn("[tier2/unlock-image] DASHSCOPE_API_KEY not configured");
    return null;
  }

  const prompt = `${styleDesc}，专业美妆妆容，精致底妆，自然眼影，红润唇色，高清写真风格，正面脸部特写`;

  const submitResp = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: "wanx2.1-imageedit",
        input: {
          function: "description_edit",
          prompt,
          base_image_url: imageDataUrl,
        },
        parameters: { n: 1 },
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!submitResp.ok) {
    const eb = await submitResp.text().catch(() => "");
    console.error(`[tier2/unlock-image] DashScope submit error ${submitResp.status}: ${eb.slice(0, 300)}`);
    return null;
  }

  const submitData: any = await submitResp.json();
  const taskId = submitData?.output?.task_id;
  if (!taskId) {
    console.error("[tier2/unlock-image] DashScope submit: no task_id in response", JSON.stringify(submitData).slice(0, 200));
    return null;
  }

  const imageUrl = await pollTaskResult(apiKey, taskId);
  if (!imageUrl) {
    console.error(`[tier2/unlock-image] Task ${taskId} timed out or failed`);
  }
  return imageUrl;
}

/**
 * 轮询 DashScope 异步任务，返回图片 URL 或 null
 */
async function pollTaskResult(apiKey: string, taskId: string): Promise<string | null> {
  const maxAttempts = 30;
  const intervalMs = 3000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const resp = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!resp.ok) {
      console.error(`[tier2/unlock-image] Poll error ${resp.status}`);
      continue;
    }

    const data: any = await resp.json();
    const status = data?.output?.task_status;
    if (status === "SUCCEEDED") {
      const url = data?.output?.results?.[0]?.url;
      if (url) return url;
      console.error("[tier2/unlock-image] Succeeded but no URL in results");
      return null;
    }
    if (status === "FAILED") {
      console.error(`[tier2/unlock-image] Task failed: ${data?.output?.message}`);
      return null;
    }
  }

  console.error("[tier2/unlock-image] Poll timed out after max attempts");
  return null;
}

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};

