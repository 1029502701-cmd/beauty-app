import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId, parseDeepseekJson } from "../../_utils";
import type { Ctx } from "../../_utils";

// 处理用户提交入驻申请（素颜照+妆容照）
// 同步上传两张照片到 R2，写入 influencers 记录（状态 pending）
// 异步走 waitUntil 触发 qwen-vl + DeepSeek 分析，写入 influencer_face_profile，删除 R2_TEMP 原图
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env, waitUntil } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const formData = await request.formData();
  const nickname = formData.get("nickname") as string;
  const bio = formData.get("bio") as string | null;
  const makeupPhoto = formData.get("makeup_photo") as File | null;
  const barePhoto = formData.get("bare_photo") as File | null;
  const stylesRaw = formData.get("styles");
  const styles = stylesRaw ? JSON.parse(stylesRaw as string) : null;

// 从 URL 自动检测平台名称
function detectPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('xiaohongshu') || host.includes('xhslink')) return '小红书';
    if (host.includes('douyin')) return '抖音';
    if (host.includes('kuaishou')) return '快手';
    if (host.includes('bilibili')) return 'B站';
    if (host.includes('weibo')) return '微博';
    if (host.includes('tiktok')) return 'TikTok';
    return host.split('.')[0];
  } catch {
    return '其他';
  }
}
const platformLink = (formData.get('platform_link') as string | null) ?? '';
const detectedPlatform = platformLink ? detectPlatform(platformLink) : null;

  if (!nickname) {
    return new Response(JSON.stringify({ error: "昵称不能为空" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!makeupPhoto) {
    return new Response(JSON.stringify({ error: "请上传妆容照" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const influencerId = generateId();

  // 检查是否重复提交（仅拦截 pending 或 approved 状态）
  const existing = await env.DB.prepare(
    `SELECT id, status FROM influencers WHERE user_id = ? AND status IN ('pending', 'approved') LIMIT 1`
  ).bind(user.userId).first<any>();
  if (existing) {
    return new Response(
      JSON.stringify({ error: "您已有入驻申请（待审核或已通过），请勿重复提交", existingId: existing.id }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 同步上传妆容照到 R2_PERM 长期桶，生成可直接访问的 URL
  const makeupKey = `influencer/${influencerId}/makeup.jpg`;
  const makeupBuf = await makeupPhoto.arrayBuffer();
  await env.R2_PERM.put(makeupKey, new Blob([makeupBuf]).stream(), {
    httpMetadata: { contentType: makeupPhoto.type || "image/jpeg" },
  });
  const makeupPhotoUrl = `/api/r2-proxy?key=${encodeURIComponent(makeupKey)}&bucket=perm`;

  // 同步上传素颜照到 R2_TEMP 临时桶，供后台审核使用
  let barePhotoKey: string | null = null;
  if (barePhoto) {
    barePhotoKey = `influencer/${influencerId}/bare.jpg`;
    const bareBuf = await barePhoto.arrayBuffer();
    await env.R2_TEMP.put(barePhotoKey, new Blob([bareBuf]).stream(), {
      httpMetadata: { contentType: barePhoto.type || "image/jpeg" },
    });
  }

  // 同步写入 influencers 记录（状态 pending），包含用户自选的擅长妆容
  await env.DB.prepare(
    `INSERT INTO influencers (id, user_id, nickname, bio, makeup_photo_url, styles, platform, link1, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(influencerId, user.userId, nickname, bio, makeupPhotoUrl, styles ? JSON.stringify(styles) : null, detectedPlatform, platformLink || null, "pending", now, now).run();

  console.log(`[influencer/apply] Saved influencer record: id=${influencerId}, status=pending`);

  // 异步走 AI 分析流程（不阻塞响应）
  if (barePhotoKey) {
    const analysisPromise = runFaceAnalysis(influencerId, barePhotoKey, env);
    waitUntil(analysisPromise);
  } else {
    // 没有素颜照，直接写默认 face_profile
    await env.DB.prepare(
      `INSERT INTO influencer_face_profile (influencer_id, face_shape, features, tags, updated_at)
       VALUES (?, '圆脸', ?, ?, ?)`
    ).bind(influencerId, JSON.stringify({ faceShape: "圆脸", highlight: "气质佳" }), "{}", now).run();
  }

  return new Response(
    JSON.stringify({
      id: influencerId,
      status: "pending",
      message: "申请已提交，我们会尽快审核并联系您...",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

async function runFaceAnalysis(influencerId: string, barePhotoKey: string, env: Ctx["env"]) {
  try {
    // Step 1: Qwen-VL 描述照片
    const obj = await env.R2_TEMP.get(barePhotoKey);
    if (!obj) {
      console.error(`[influencer/apply] Bare photo not found in R2_TEMP: ${barePhotoKey}`);
      return;
    }
    const photoBuf = await obj.arrayBuffer();
    const photoBase64 = Buffer.from(photoBuf).toString("base64");
    const visionPrompt = "请用中文描述这张照片中人物面部特征，包括脸型、皮肤类型、眉毛形状、眼睛形状、三庭五眼比例、对称度。描述要专业且简洁，每点一句话。只输出描述，不要其他内容。";

    const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DASHSCOPE_API_KEY}` },
      body: JSON.stringify({
        model: "qwen-vl-max",
        messages: [{ role: "user", content: [{ type: "text", text: visionPrompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photoBase64}` } }] }],
        max_tokens: 500,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!resp.ok) {
      console.error(`[influencer/apply] DashScope vision error: ${resp.status}`);
      return;
    }

    const data: any = await resp.json();
    const textDesc = data?.choices?.[0]?.message?.content?.trim();
    if (!textDesc) {
      console.error("[influencer/apply] DashScope returned empty description");
      return;
    }
    console.log(`[influencer/apply] Vision OK, desc len: ${textDesc.length}`);

    // Step 2: DeepSeek 结构化分析
    const dsKey = env.DEEPSEEK_API_KEY;
    if (!dsKey) {
      console.error("[influencer/apply] DEEPSEEK_API_KEY not configured, skipping DeepSeek");
      return;
    }

    const dsPrompt = `You are a professional beauty consultant. Based on the following face description, select exactly one option from each category and provide personalized advice.

[Face Description]
${textDesc}

faceShape: 鹅蛋脸, 圆脸, 方脸, 长脸, 心形脸, 菱形脸, 方形脸
skinType: 干性, 油性, 混合肌, 敏感性, 中性偏干
eyebrowShape: 一字眉, 柳叶眉, 拱眉, 平眉, 挑眉, 断眉, 细眉
eyeShape: 凤眼, 桃花眼, 圆眼, 细长眼, 水滴眼, 下垂眼, 双眼皮
threeFiveRatio: 上中下均衡, 中庭偏长, 中庭偏短, 上庭偏宽, 下庭偏窄, 三庭偏短
symmetry: 高对称度, 中等对称度, 低对称度
personaTags: 甜美可爱, 气质优雅, 知性温婉, 御姐霸气, 清纯邻家, 酷飒个性

Return a JSON object with these exact keys:
{
  "faceShape": "one of the options above",
  "skinType": "one of the options above",
  "eyebrowShape": "one of the options above",
  "eyeShape": "one of the options above",
  "threeFiveRatio": "one of the options above",
  "symmetry": "one of the options above",
  "personaTags": "one of the options above",
  "highlight": "A one-sentence catchy compliment that highlights the user's most distinctive beauty feature, written in natural Chinese. Keep it warm and personal, around 10-20 Chinese characters.",
  "suggestions": ["3-5 specific, actionable makeup or skincare tips in Chinese, each around 10-20 characters."]
}`;

    const dsResp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${dsKey}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: dsPrompt }], max_tokens: 500, temperature: 0.3 }),
      signal: AbortSignal.timeout(25000),
    });

    if (!dsResp.ok) {
      console.error(`[influencer/apply] DeepSeek error: ${dsResp.status}`);
      return;
    }

    const dsData: any = await dsResp.json();
    const raw = dsData?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error("[influencer/apply] DeepSeek response has no content");
      return;
    }

    const report = parseDeepseekJson(raw);
    if (!report) {
      console.error("[influencer/apply] DeepSeek returned invalid JSON");
      return;
    }

    let faceShape = String(report.faceShape ?? "圆脸");
    let tags = "{}";
    let features = "";

    try {
      tags = JSON.stringify({
        faceShape: report.faceShape,
        skinType: report.skinType,
        eyebrowShape: report.eyebrowShape,
        eyeShape: report.eyeShape,
        threeFiveRatio: report.threeFiveRatio,
        symmetry: report.symmetry,
        personaTags: report.personaTags,
      });
      features = JSON.stringify({
        faceShape,
        highlight: report.highlight,
        suggestions: Array.isArray(report.suggestions) ? report.suggestions : [],
      });
    } catch (e) {
      console.error(`[influencer/apply] Failed to serialize report: ${e}`);
      return;
    }

    console.log(`[influencer/apply] DeepSeek OK, faceShape=${faceShape}`);

    // Step 3: 写入 influencer_face_profile
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO influencer_face_profile (influencer_id, face_shape, features, tags, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(influencerId, faceShape, features, tags, now).run();
    console.log(`[influencer/apply] Wrote face_profile for ${influencerId}`);

    // Step 4: 删除 R2_TEMP 中的素颜原图
    await env.R2_TEMP.delete(barePhotoKey);
    console.log(`[influencer/apply] Deleted bare photo from R2_TEMP: ${barePhotoKey}`);

  } catch (e) {
    console.error(`[influencer/apply] Background analysis failed for ${influencerId}:`, e);
  }
}

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};

