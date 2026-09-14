import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, parseDeepseekJson, callTier3Flexible, getChatProviderConfig, callChatProvider, generateId } from "../../_utils";

import { findProductByKeyword } from "../_taobao";
import type { Ctx } from "../../_utils";

// POST /api/tier3/generate
// 入参：tier1ReportId（可选）、questionnaireAnswers（4个维度选择结果）
// 逻辑：检查可用 token → 查 tier1 报告 → 调用 DeepSeek 生成场景化建议 → 消耗 token → 纯新增写入 reports_tier3
// 专属报告是用户真实消耗积分/付费/兑换码生成的产物，采用纯新增（append-only）模式：
// 每次生成都是一条新记录，不删除旧记录；旧报告由 30 天 expire_at 机制自然过期清理，
// 个人中心/档案页通过 "ORDER BY created_at DESC LIMIT 1" 展示当前最新一份。
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  try {
    return await handleTier3Generate(context);
  } catch (e) {
    console.error("[tier3/generate] UNCAUGHT ERROR:", e);
    return new Response(
      JSON.stringify({ error: "服务器内部错误", retryable: true }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

async function handleTier3Generate(context: Parameters<typeof POST>[0]) {
  const { request, env } = context;
  console.log("[tier3/generate] request received");
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 直连中枢用户态积分接口（当前登录用户自己的 JWT；中枢按 user_id 操作 user_points）
  const AUTH_CENTER_BASE = 'https://auth.meijian.top';
  const jwt = (() => {
    const h = request.headers.get('Authorization') || '';
    return h.startsWith('Bearer ') ? h.slice(7).trim() : h.trim();
  })();

  let tier1ReportId: string | undefined;
  let questionnaireAnswers: Record<string, string> | undefined;
  let fromPoints: boolean | undefined;
  let facePhotoKey: string | undefined;
  try {
    const body = (await request.json()) as {
      tier1ReportId?: string;
      questionnaireAnswers?: Record<string, string>;
      fromPoints?: boolean;
      facePhotoKey?: string;
    };
    tier1ReportId = body.tier1ReportId;
    questionnaireAnswers = body.questionnaireAnswers;
    fromPoints = body.fromPoints;
    facePhotoKey = body.facePhotoKey;
  } catch {
    return new Response(
      JSON.stringify({ error: "请求体不是合法 JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // tier1ReportId is now optional - standalone tier3 generation is supported
  if (!questionnaireAnswers || typeof questionnaireAnswers !== "object") {
    return new Response(
      JSON.stringify({ error: "缺少 questionnaireAnswers" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 1. 检查生成权限来源（两条并列路径，互不依赖）：
  //    路径 A：积分抵扣成功（fromPoints，前端已通过 /api/points/consume 扣积分）
  //    路径 B：用户拥有可用 token（预检；真正消耗在步骤 4 的原子认领完成，先到先得）
  const isPointsUnlock = fromPoints === true;
  let tokenRow: { id: string } | null = null;
  if (!isPointsUnlock) {
    tokenRow = await env.DB.prepare(
      `SELECT id FROM tokens WHERE user_id = ? AND status = 'unused' ORDER BY created_at LIMIT 1`
    )
      .bind(user.userId)
      .first<{ id: string }>();
    if (!tokenRow) {
      return new Response(
        JSON.stringify({ error: "no_token", message: "无可用 token，请使用积分或兑换码/购买解锁" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // 2. 查 tier1 报告数据（可选：无初识报告时使用空数据兜底）
  let tier1Report: Record<string, unknown> = {};
  if (tier1ReportId) {
    const tier1Row = await env.DB.prepare(
      `SELECT report_data FROM reports_tier1 WHERE id = ? AND user_id = ? LIMIT 1`
    )
      .bind(tier1ReportId, user.userId)
      .first<any>();
    if (tier1Row) {
      try {
        tier1Report = JSON.parse(tier1Row.report_data) as Record<string, unknown>;
      } catch {
        console.warn("[tier3/generate] tier1 report data parse failed, using empty report");
      }
    }
  } else {
    console.log("[tier3/generate] No tier1ReportId, generating with empty report data");
  }

  // 3. 调用 DeepSeek 生成场景化妆容建议
  const t0 = Date.now();
  const reportContent = await callTier3Flexible(tier1Report, questionnaireAnswers, env);
  const dsMs = Date.now() - t0;
  console.log(`[tier3/generate] deepseek done in ${dsMs}ms, ok=${!!reportContent}`);

  if (!reportContent) {
    return new Response(
      JSON.stringify({ error: "生成失败", retryable: true, message: "AI 服务调用失败，请重试" }),
      { status: 504, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3.5 为 productRecs 补全淘宝商品数据（图片、链接、价格），限时 15s
  // 保证整个请求仍在 Cloudflare 30s wall-clock 限制内
  try {
    const recs = reportContent.productRecs;
    if (recs && typeof recs === "object" && !Array.isArray(recs)) {
      const t0 = Date.now();
      for (const dim of Object.keys(recs)) {
        const items = recs[dim];
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (!item || typeof item !== "object" || !item.name) continue;
          if (item.itemUrl) continue; // already enriched
          if (Date.now() - t0 > 4500) break;
          try {
            const product = await findProductByKeyword(String(item.name), env);
            if (product) {
              item.imageUrl = product.imageUrl;
              item.price = product.price;
              item.itemUrl = product.itemUrl;
              item.shopTitle = product.shopTitle;
            }
          } catch { /* 单品失败不阻断 */ }
        }
      }
      const since = Date.now() - t0;
      console.log("[tier3/generate] productRecs enriched, elapsed=" + (Date.now() - t0) + "ms");
      if (since > 9000) console.log("[tier3/generate] enrichment budget exceeded: " + since + "ms, stop");
    }
  } catch (e) {
    console.warn("[tier3/generate] productRecs enrichment failed, continuing:", e);
  }

  // 4. 原子认领 token（仅 token 路径）：仅当它仍为 unused 时才置为 used（防止并发双击时
  //    同一个 token 被两个请求同时选中、一份钱生成两份报告；抢到的请求正常写报告，
  //    抢不到的返回 403 no_token，不写报告）。积分路径不消耗 token，tokenRow 为 null。
  const now = Math.floor(Date.now() / 1000);
  if (tokenRow) {
    const claim = await env.DB.prepare(
      `UPDATE tokens SET status = 'used', used_at = ? WHERE id = ? AND status = 'unused'`
    )
      .bind(now, tokenRow.id)
      .run();
    if (!claim.meta?.changes) {
      return new Response(
        JSON.stringify({ error: "no_token", message: "token 刚被另一请求消耗，请重新生成" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // 5. 写入 reports_tier3（纯新增：不删除旧记录，旧报告由 30 天 expire_at 机制自然清理）
  //    token_id 可空：积分解锁的报告不关联 token；token 解锁的报告关联已消耗的 token。
  // 3档报告生成成功 → 直连中枢 /api/points/grant-tier3（带用户 JWT；去重/金额由中枢定，中枢负责幂等）
  let tier3Points: { granted: boolean; balance: number } | null = null;
  try {
    const grantRes = await fetch(AUTH_CENTER_BASE + "/api/points/grant-tier3", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + jwt },
      body: "{}",
      signal: AbortSignal.timeout(5000), // 5s 超时：中枢慢不拖垮 30s 全局预算
    });
    const grantData = await grantRes.json().catch(() => ({}));
    tier3Points = { granted: !!grantData.granted, balance: typeof grantData.balance === "number" ? grantData.balance : 0 };
  } catch (e) {
    console.warn("[tier3/generate] grant-tier3 call failed, skipping points:", e);
  }
  const reportId = generateId();
  const expireAt = now + 30 * 24 * 60 * 60;
  const scenario = questionnaireAnswers.scenario ?? "日常通勤";

  await env.DB.prepare(
    `INSERT INTO reports_tier3 (id, user_id, token_id, scenario, quiz_answers, content, created_at, expire_at, face_photo_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      reportId,
      user.userId,
      tokenRow ? tokenRow.id : null,
      scenario,
      JSON.stringify(questionnaireAnswers),
      JSON.stringify(reportContent),
      now,
      expireAt,
      facePhotoKey || null
    )
    .run();

  // 积分解锁路径：生成成功即完成一次解锁，顺带把本端"已解锁资格"落库（幂等，不重复写）。
  // 这样即便前端漏调 /points-unlock-record，资格也一定有持久化记录，刷新/换设备不丢。
  if (isPointsUnlock) {
    try {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO tier3_points_unlock (user_id, source, report_ref, unlocked_at)
         VALUES (?, 'points', ?, ?)`
      ).bind(user.userId, reportId, now).run();
    } catch (e) {
      console.warn("[tier3/generate] tier3_points_unlock record failed, continuing:", e);
    }
  }

  // 回传最新积分余额（直连中枢 /api/points/balance，带用户 JWT），前端据此刷新展示，保证"扣完积分"数字对得上。
  let latestBalance: number | null = null;
  try {
    const balRes = await fetch(AUTH_CENTER_BASE + "/api/points/balance", {
      headers: { Authorization: "Bearer " + jwt },
      signal: AbortSignal.timeout(5000), // 5s 超时
    });
    const balData = await balRes.json().catch(() => ({}));
    if (balRes.ok && typeof balData.balance === "number") latestBalance = balData.balance;
  } catch (e) {
    console.warn("[tier3/generate] balance read failed, returning null:", e);
  }

  // 5.5 生成并插入 AI 妆效图（参考进阶报告机制）：按后台 image_model_provider 调 Agnes/DashScope 图生图，
  //    产出存 R2_TEMP，ai_image_url 写 reports_tier3。失败不影响报告主体。
  const tImg = Date.now(); // AI 图 8s 预算起点
  let aiImageUrl: string | null = null;
  try {
    let imageProvider = "dashscope";
    const provRow = await env.DB.prepare("SELECT value FROM app_config WHERE key = 'image_model_provider' LIMIT 1").first();
    if (provRow?.value?.trim()) imageProvider = provRow.value.trim().toLowerCase();

    const styleDesc = buildTier3StyleDesc(reportContent, questionnaireAnswers);
    const refKey = facePhotoKey || (await (async () => {
      // 回退：用户当天 tier2/tier3 报告里的照片 key
      const r = await env.DB.prepare("SELECT face_photo_key FROM reports_tier3 WHERE user_id = ? AND face_photo_key IS NOT NULL ORDER BY created_at DESC LIMIT 1").bind(user.userId).first();
      return r?.face_photo_key || null;
    })());
    if (refKey && Date.now() - tImg < 2500) { // AI 图仅剩最后 2.5s 才启动，避免拖垮全局 30s
      // 读 R2 照片转 dataURL
      const obj = await env.R2_TEMP.get(refKey);
      if (obj && "body" in obj) {
        const buf = Buffer.from(await obj.arrayBuffer());
        const dataUrl = "data:image/jpeg;base64," + buf.toString("base64");
        const provider = await getImageProviderConfig(env);
        const imgTask = imageProvider === "agnes"
          ? agnesImageTask(dataUrl, styleDesc, provider)
          : dashscopeImageTask(dataUrl, styleDesc, provider, 4000); // DashScope 异步任务需 >4s，固定 4s 窗口
        const genUrl = await imgTask;
        if (genUrl) {
          const dl = await fetch(genUrl, { signal: AbortSignal.timeout(3000) });
          if (dl.ok) {
            const r2Key = "tier3-ai/" + generateId() + ".jpg";
            await env.R2_TEMP.put(r2Key, new Uint8Array(await dl.arrayBuffer()), { httpMetadata: { contentType: "image/jpeg" } });
            aiImageUrl = r2Key;
            await env.DB.prepare("UPDATE reports_tier3 SET ai_image_url = ? WHERE id = ?").bind(r2Key, reportId).run();
          }
        }
      }
    }
  } catch (e) {
    console.warn("[tier3/generate] AI image generation failed (non-blocking):", e);
  }

  return new Response(
    JSON.stringify({ id: reportId, content: reportContent, expireAt, facePhotoKey, aiImageUrl, points: tier3Points, balance: latestBalance }),
    { headers: { "Content-Type": "application/json" } }
  );
};


export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};






// 从 tier3 报告内容/问卷里提取妆效图提示词（风格描述）
function buildTier3StyleDesc(report: Record<string, unknown>, q: Record<string, string>): string {
  const styleNote = String(report.styleNote || "");
  const scenario = String(q.scenario || report._scenario || "日常");
  const makeupStyle = String(q.makeupStyle || "");
  let base = makeupStyle || styleNote || "精致自然妆";
  base = base.replace(/[，。；,.;]+$/, "");
  return base.length > 0 ? base : "清新自然淡妆";
}


// ---------------- AI 妆效图（tier3）辅助：Agnes 优先 / DashScope 回退 ----------------
interface ImgProviderCfg { apiKey: string; kind: "agnes" | "dashscope"; }

// 解析图像供应商（agnes 需 AGNES_API_KEY；dashscope 需 DASHSCOPE_API_KEY）
async function getImageProviderConfig(env: Ctx["env"]): Promise<ImgProviderCfg> {
  let kind: "agnes" | "dashscope" = "dashscope";
  try {
    const r = await env.DB.prepare("SELECT value FROM app_config WHERE key = 'image_model_provider' LIMIT 1").first();
    if (r?.value?.trim().toLowerCase() === "agnes") kind = "agnes";
  } catch { /* 默认 dashscope */ }
  if (kind === "agnes") {
    if (env.AGNES_API_KEY) return { apiKey: env.AGNES_API_KEY, kind: "agnes" };
    // agnes 无 key 时回退 dashscope
    kind = "dashscope";
  }
  const dkey = env.DASHSCOPE_API_KEY;
  if (dkey) return { apiKey: dkey, kind: "dashscope" };
  if (env.AGNES_API_KEY) return { apiKey: env.AGNES_API_KEY, kind: "agnes" };
  return { apiKey: "", kind: "dashscope" };
}

// Agnes 图生图（同步返回 URL）
async function agnesImageTask(dataUrl: string, styleDesc: string, cfg: ImgProviderCfg): Promise<string | null> {
  if (!cfg.apiKey) return null;
  const rawB64 = dataUrl.includes(",") ? dataUrl.split(",").pop() : dataUrl;
  const prompt =
    "为这位女性添加" + styleDesc + "的彩妆妆效：自然通透底妆、柔和眼影、红润唇色、淡淡腮红。" +
    "要求真实自然的妆面效果，保持原有肤色与肤质。灯光必须是自然暖色柔光（暖白/日光），绝对禁止蓝色、紫色、青色等冷色调或霓虹灯光。" +
    "不要改变服装与背景。保留原始构图、面部特征、相机角度、发型与背景不变，只改变妆容。写实摄影风格，高清。";
  const resp = await fetch("https://apihub.agnes-ai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: "Bearer " + cfg.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "agnes-image-2.5-flash", prompt, size: "2K", ratio: "3:4", extra_body: { image: [rawB64], response_format: "url" } }),
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) { console.warn("[tier3/agnes] HTTP " + resp.status); return null; }
  const data: any = await resp.json();
  return data?.data?.[0]?.url || null;
}

// DashScope wanx2.1-imageedit（异步任务，轮询取 URL）
async function dashscopeImageTask(dataUrl: string, styleDesc: string, cfg: ImgProviderCfg, budgetMs = 8000): Promise<string | null> {
  if (!cfg.apiKey) return null;
  const prompt = styleDesc + "，专业美妆妆容，精致底妆，自然眼影，红润唇色，高清写真风格，正面脸部特写";
  const submit = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis", {
    method: "POST",
    headers: { Authorization: "Bearer " + cfg.apiKey, "Content-Type": "application/json", "X-DashScope-Async": "enable" },
    body: JSON.stringify({ model: "wanx2.1-imageedit", input: { image_url: dataUrl, prompt }, parameters: { function: "description_edit", strength: 0.3 } }),
    signal: AbortSignal.timeout(4000),
  });
  if (!submit.ok) { console.warn("[tier3/dashscope] submit " + submit.status); return null; }
  const sd: any = await submit.json();
  const taskId = sd?.output?.task_id;
  if (!taskId) return null;
  const dsT0 = Date.now();
  for (let i = 0; i < 6; i++) {
    if (Date.now() - dsT0 > budgetMs) return null;
    const wait = Math.max(1200, Math.min(3000, budgetMs - (Date.now() - dsT0)));
    await new Promise((r) => setTimeout(r, wait));
    const q = await fetch("https://dashscope.aliyuncs.com/api/v1/tasks/" + taskId, {
      headers: { Authorization: "Bearer " + cfg.apiKey },
      signal: AbortSignal.timeout(3000),
    });
    const qd: any = await q.json();
    const st = qd?.output?.task_status;
    if (st === "SUCCEEDED") return qd?.output?.results?.[0]?.url || qd?.output?.result_url || null;
    if (st === "FAILED") { console.warn("[tier3/dashscope] task failed"); return null; }
  }
  return null;
}
