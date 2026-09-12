import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId , parseDeepseekJson } from "../../_utils";
import { findProductByKeyword } from "../_taobao";
import type { Ctx } from "../../_utils";

// POST /api/tier3/generate
// 入参：tier1ReportId（可选）、questionnaireAnswers（4个维度选择结果）
// 逻辑：检查可用 token → 查 tier1 报告 → 调用 DeepSeek 生成场景化建议 → 消耗 token → 纯新增写入 reports_tier3
// 专属报告是用户真实消耗积分/付费/兑换码生成的产物，采用纯新增（append-only）模式：
// 每次生成都是一条新记录，不删除旧记录；旧报告由 30 天 expire_at 机制自然过期清理，
// 个人中心/档案页通过 "ORDER BY created_at DESC LIMIT 1" 展示当前最新一份。
const AUTH_CENTER_URL = "https://auth.meijian.top";

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

  const authToken = (request.headers.get("Authorization") || "").replace(/^Bearer /, "");

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
  const dsStart = Date.now();
  const reportContent = await callDeepSeekTier3(tier1Report, questionnaireAnswers, env);
  console.log(`[tier3/generate] deepseek done in ${Date.now() - dsStart}ms, ok=${!!reportContent}`);

  if (!reportContent) {
    return new Response(
      JSON.stringify({ error: "生成失败", retryable: true, message: "AI 服务调用失败，请重试" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
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
          if (Date.now() - t0 > 15000) break;
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
      console.log("[tier3/generate] productRecs enriched, elapsed=" + (Date.now() - t0) + "ms");
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
  // 3档报告生成成功 → 调中枢 grant-tier3（去重/金额由中枢定，中枢负责幂等）
  let tier3Points: { granted: boolean; balance: number } | null = null;
  if (authToken) {
    try {
      const grantRes = await fetch(AUTH_CENTER_URL + "/api/points/grant-tier3", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken },
      });
      const grantData: any = await grantRes.json().catch(() => ({}));
      tier3Points = { granted: !!grantData.granted, balance: typeof grantData.balance === "number" ? grantData.balance : 0 };
    } catch (e) {
      console.warn("[tier3/generate] grant-tier3 call failed, skipping points:", e);
    }
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

  return new Response(
    JSON.stringify({ id: reportId, content: reportContent, expireAt, facePhotoKey, points: tier3Points }),
    { headers: { "Content-Type": "application/json" } }
  );
};

async function callDeepSeekTier3(
  tier1Report: Record<string, unknown>,
  questionnaireAnswers: Record<string, string>,
  env: Ctx["env"]
): Promise<Record<string, unknown> | null> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[tier3/generate] DEEPSEEK_API_KEY not configured");
    return null;
  }

  const style = questionnaireAnswers.makeupStyle ?? "";
  const scenario = questionnaireAnswers.scenario ?? "";
  const skillLevel = questionnaireAnswers.skillLevel ?? "";
  const timeCost = questionnaireAnswers.timeCost ?? "";

  const prompt = `You are a professional beauty consultant. Based on the user's face analysis and their preferences, provide a detailed, personalized makeup guide.

User's Face Analysis Report:
${JSON.stringify(tier1Report, null, 2)}

User's Preferences (from questionnaire):
- 妆容风格 (makeupStyle): ${style}
- 使用场景 (scenario): ${scenario}
- 熟练程度 (skillLevel): ${skillLevel}
- 时间成本 (timeCost): ${timeCost}

Please output a JSON object with the following structure (strict JSON only, no markdown):
{
  "overallAdvice": "string - one paragraph of overall advice tailored to this style/scenario/skill level/time",
  "stepByStep": [
    {
      "step": "number",
      "title": "string - step title in Chinese",
      "description": "string - detailed instruction tailored to user's skill level and time budget",
      "timeEstimate": "string - e.g. '2分钟' or '5分钟'",
      "difficultyHint": "string - '适合新手' or '进阶技巧' based on skillLevel"
    }
  ],
  "productRecs": {
    "base": [{"name": "产品名", "reason": "简短推荐理由"}],
    "eyes": [{"name": "产品名", "reason": "简短推荐理由"}],
    "lips": [{"name": "产品名", "reason": "简短推荐理由"}],
    "cheeks": [{"name": "产品名", "reason": "简短推荐理由"}]
  },
  "tips": ["string - 3-5 personalized tips based on the user's features and preferences"],
  "timeWarning": "string - reminder about time budget given the selected timeCost",
  "styleNote": "string - how the ${style} style should be adapted for ${scenario} scenario"
}

Guidelines:
- Make every piece of advice specific to the user's face features from the report
- Adapt difficulty based on skillLevel (新手=简单步骤, 熟练进阶=专业技巧)
- Keep step count reasonable for timeCost (5分钟极简=3-4步, 30分钟以上精致=6-8步)
- All text in Chinese except JSON keys
- Be concrete: mention specific techniques, product types, and application methods`;

  try {
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
        temperature: 0.6,
      }),
      // 必须小于 Cloudflare Pages 的 30 秒 wall-clock 限制，否则整个函数会被
      // Cloudflare 强杀并返回 502（业务 try/catch 抓不到）；改为 25 秒内优雅失败
      signal: AbortSignal.timeout(25000),
    });

    if (!resp.ok) {
      const eb = await resp.text().catch(() => "");
      console.error(`[tier3/generate] DeepSeek error ${resp.status}: ${eb.slice(0, 200)}`);
      return null;
    }

    const data: any = await resp.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error("[tier3/generate] DeepSeek empty response");
      return null;
    }

    const report = parseDeepseekJson(raw);
    return report as Record<string, unknown>;
  } catch (e) {
    console.error("[tier3/generate] DeepSeek exception:", e);
    return null;
  }
}

export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
