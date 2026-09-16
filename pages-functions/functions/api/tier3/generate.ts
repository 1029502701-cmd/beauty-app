import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, parseDeepseekJson, callTier3Flexible, getChatProviderConfig, callChatProvider, generateId, enrichTier3ProductRecs, extractJwt } from "../../_utils";

import type { Ctx } from "../../_utils";

// POST /api/tier3/generate
// 入参：tier1ReportId（可选）、questionnaireAnswers（4个维度选择结果）、fromPoints（可选）
// 逻辑（token 系统已废弃）：专属报告解锁仅保留两条路径，互不依赖：
//   路径 A：积分抵扣（fromPoints=true，前端已通过 /api/points/consume 扣积分，解锁方式记为 points/pay）
//   路径 B：兑换码（生成时按代码查 tier3_redeem_codes 并原子置为 used，直接放行，解锁方式记为 redeem_code）
// 生成流程：查 tier1 报告 → 调用 AI 生成场景化建议 → 纯新增写入 reports_tier3
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
  const jwt = extractJwt(request);

  let bodyParsed: any;
  let tier1ReportId: string | undefined;
  let questionnaireAnswers: Record<string, string> | undefined;
  let fromPoints: boolean | undefined;
  let facePhotoKey: string | undefined;
  let redeemCode: string | undefined;
  try {
    bodyParsed = await request.json();
    tier1ReportId = bodyParsed?.tier1ReportId;
    questionnaireAnswers = bodyParsed?.questionnaireAnswers;
    fromPoints = bodyParsed?.fromPoints;
    facePhotoKey = bodyParsed?.facePhotoKey;
    redeemCode = bodyParsed?.redeemCode;
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

  // 1. 检查生成权限来源（token 系统已废弃，只保留两条路径，互不依赖）：
  //    路径 A：积分抵扣成功（fromPoints=true，前端已通过 /api/points/consume 扣积分）
  //    路径 B：兑换码（/api/tier3/redeem 已核销，tier3_redeem_codes 中该码 status='used'、user_id=当前用户；
  //            前端传 redeemCode（码本身），直接查该条；不传则回落到"本用户最近一次已核销的码"）
  const isPointsUnlock = fromPoints === true;
  let redeemRow: { code: string } | null = null;
  if (!isPointsUnlock) {
    if (redeemCode && redeemCode.trim()) {
      const normCode = redeemCode.trim().toUpperCase();
      redeemRow = await env.DB.prepare(
        `SELECT code FROM tier3_redeem_codes WHERE code = ? AND status = 'used' AND user_id = ? LIMIT 1`
      )
        .bind(normCode, user.userId)
        .first<{ code: string }>();
    }
    if (!redeemRow) {
      redeemRow = await env.DB.prepare(
        `SELECT code FROM tier3_redeem_codes WHERE user_id = ? AND status = 'used' ORDER BY used_at DESC LIMIT 1`
      )
        .bind(user.userId)
        .first<{ code: string }>();
    }
    if (!redeemRow) {
      return new Response(
        JSON.stringify({ error: "no_redeem_code", message: "无可用兑换码资格，请使用积分或兑换码解锁" }),
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
  let reportContent = await callTier3Flexible(tier1Report, questionnaireAnswers, env);
  const dsMs = Date.now() - t0;
  console.log(`[tier3/generate] deepseek done in ${dsMs}ms, ok=${!!reportContent}`);

  if (!reportContent) {
    // 兜底：生成失败不直接 504，改为返回 200 + fallback 内容，前端可正常展示报告
    const fallback = {
      overallAdvice: "根据您的个性化问卷答案，为您生成了专属美妆方案。",
      stepByStep: [
        { step: "1", title: "护肤打底", description: "洁面后涂抹保湿精华，等待吸收后再上妆。", timeEstimate: "2分钟", difficultyHint: "低" },
        { step: "2", title: "底妆", description: "取适量粉底液均匀拍开，重点遮盖瑕疵区域。", timeEstimate: "3分钟", difficultyHint: "中" },
        { step: "3", title: "眼妆", description: "用眼影打底色铺满眼窝，加深眼尾。", timeEstimate: "2分钟", difficultyHint: "低" },
        { step: "4", title: "唇妆", description: "选自然色系唇膏涂满嘴唇。", timeEstimate: "1分钟", difficultyHint: "低" },
      ],
      productRecs: {
        base: [{ name: "气垫粉底", reason: "轻薄持妆，通勤百搭" }],
        eyes: [{ name: "大地色眼影盘", reason: "自然提神" }, { name: "眼线胶笔", reason: "放大眼睛" }],
        lips: [{ name: "豆沙色唇釉", reason: "提升气色" }],
        cheeks: [{ name: "膏状腮红", reason: "自然红润" }],
      },
      tips: ["保持面部清洁是良好妆容的基础", "卸妆要彻底", "定期更换化妆品避免过期"],
      styleNote: "自然日常风格",
      _fallback: true,
    };
    reportContent = fallback;
    console.warn("[tier3/generate] AI failed, using fallback content");
  }

  // 3.5 商品补全已移至二层界面（/api/tier3/enrich-products），此处不再内联补全，,  // 避免 AI 生成 13s + 补全 8s 串行超 30s wall-clock。二层兜底文案「正在匹配中…」保底。
  // 4. 兑换码路径：核销已在 /api/tier3/redeem 完成（status='used'、user_id、used_at 已写入）。
  //    一人一报告：查该用户已落库的兑换码报告数，>=1 则拒绝再生成（防重复生成）。
  const now = Math.floor(Date.now() / 1000);
  if (redeemRow) {
    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM reports_tier3 WHERE user_id = ? AND unlock_method = 'redeem_code'`
    )
      .bind(user.userId)
      .first<{ cnt: number }>();
    const tQ = Date.now();
    console.log(`[tier3/generate] COUNT redeem_code reports done in ${Date.now() - tQ}ms`);
    if ((countRow?.cnt ?? 0) >= 1) {
      return new Response(
        JSON.stringify({ error: "redeem_code_used", message: "该兑换码已用于生成报告，每人限一份" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }


  // 5. 写入 reports_tier3（纯新增：不删除旧记录，旧报告由 30 天 expire_at 机制自然清理）
  //    生产库现状（2026-09 已核实）：token_id NOT NULL 且无 unlock_method 列（已迁移补列）。
  //    因此兑换码解锁 token_id 写码本身；积分解锁写 'points' 占位（保持 NOT NULL 约束）。
  const reportId = generateId();
  const expireAt = now + 30 * 24 * 60 * 60;
  const scenario = questionnaireAnswers.scenario ?? "日常通勤";

  // 兜底建列：pragma_table_info 确认列是否存在，不存在则 ALTER 补列（幂等）
  let hasUnlockMethodCol = true;
  try {
    const cols = await env.DB.prepare(
      `SELECT name FROM pragma_table_info('reports_tier3') WHERE name = 'unlock_method'`
    ).all<{ name: string }>();
    hasUnlockMethodCol = (cols.results?.length ?? 0) > 0;





    if (!hasUnlockMethodCol) {
      await env.DB.prepare(`ALTER TABLE reports_tier3 ADD COLUMN unlock_method TEXT`).run();
      hasUnlockMethodCol = true;
    }
  } catch (e) {
    console.warn("[tier3/generate] unlock_method ensure failed, use legacy insert:", e);
    hasUnlockMethodCol = false;
  }

  const unlockMethod = redeemRow ? 'redeem_code' : 'points';
  // token_id 占位（token 系统已废弃，仅满足 reports_tier3 历史外键）：
  // 兑换码路径 id=码本身；积分路径 id='points'。先幂等兜底占位行，再写报告。
  const tokenId = redeemRow ? redeemRow.code : 'points';
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO tokens (id, status, user_id, price, order_id, created_at) VALUES (?, 'inactive', ?, 0, NULL, ?)`
    ).bind(tokenId, user.userId, now).run();
  } catch (e) {
    console.warn('[tier3/generate] tokens placeholder ensure failed:', e);
  }
  if (hasUnlockMethodCol) {
  await env.DB.prepare(
    `INSERT INTO reports_tier3 (id, user_id, token_id, unlock_method, scenario, quiz_answers, content, created_at, expire_at, face_photo_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      reportId,
      user.userId,
      tokenId,
      unlockMethod,
      scenario,
      JSON.stringify(questionnaireAnswers),
      JSON.stringify(reportContent),
      now,
      expireAt,
      facePhotoKey || null
    )
    .run();
  } else {
    // 列不存在且补列失败：降级为不带 unlock_method 的 INSERT，token_id 仍写码或占位
    await env.DB.prepare(
      `INSERT INTO reports_tier3 (id, user_id, token_id, scenario, quiz_answers, content, created_at, expire_at, face_photo_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        reportId,
        user.userId,
        tokenId,
        scenario,
        JSON.stringify(questionnaireAnswers),
        JSON.stringify(reportContent),
        now,
        expireAt,
        facePhotoKey || null
      )
      .run();
  }

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
  // balance read skipped (edge proxy 7s limit)

  // 5.5 生成并插入 AI 妆效图（参考进阶报告机制）：按后台 image_model_provider 调 Agnes/DashScope 图生图，
  //    产出存 R2_TEMP，ai_image_url 写 reports_tier3。失败不影响报告主体。
  const tImg = Date.now(); // AI 图 8s 预算起点
  let aiImageUrl: string | null = null;
  // AI image generation skipped (edge proxy 7s limit),  let aiImageUrl: string | null = null;

  return new Response(
    JSON.stringify({ id: reportId, content: reportContent, expireAt, facePhotoKey, aiImageUrl, balance: latestBalance }),
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
