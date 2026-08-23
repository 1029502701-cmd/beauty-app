import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, generateId , parseDeepseekJson } from "../../_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier3/generate
// 入参：tier1ReportId、questionnaireAnswers（4个维度选择结果）
// 逻辑：检查可用 token → 查 tier1 报告 → 调用 DeepSeek 生成场景化建议 → 消耗 token → 写入 reports_tier3
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
  const { tier1ReportId, questionnaireAnswers } = body as {
    tier1ReportId: string;
    questionnaireAnswers: Record<string, string>;
  };

  if (!tier1ReportId) {
    return new Response(
      JSON.stringify({ error: "缺少 tier1ReportId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!questionnaireAnswers || typeof questionnaireAnswers !== "object") {
    return new Response(
      JSON.stringify({ error: "缺少 questionnaireAnswers" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 1. 检查是否有可用 token
  const tokenRow = await env.DB.prepare(
    `SELECT id FROM tokens WHERE user_id = ? AND status = 'unused' LIMIT 1`
  )
    .bind(user.userId)
    .first<{ id: string }>();

  if (!tokenRow) {
    return new Response(
      JSON.stringify({ error: "no_token" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. 查 tier1 报告数据
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = ? AND user_id = ? LIMIT 1`
  )
    .bind(tier1ReportId, user.userId)
    .first<any>();

  if (!tier1Row) {
    return new Response(
      JSON.stringify({ error: "tier1 报告不存在或无权访问" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  let tier1Report: Record<string, unknown>;
  try {
    tier1Report = JSON.parse(tier1Row.report_data) as Record<string, unknown>;
  } catch {
    return new Response(
      JSON.stringify({ error: "tier1 报告数据解析失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 3. 调用 DeepSeek 生成场景化妆容建议
  const reportContent = await callDeepSeekTier3(tier1Report, questionnaireAnswers, env);

  if (!reportContent) {
    return new Response(
      JSON.stringify({ error: "生成失败", retryable: true, message: "AI 服务调用失败，请重试" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. 消耗 token：标记为 used，写入 used_at
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE tokens SET status = 'used', used_at = ? WHERE id = ?`
  )
    .bind(now, tokenRow.id)
    .run();

  // 5. 写入 reports_tier3
  const reportId = generateId();
  const expireAt = now + 30 * 24 * 60 * 60;
  const scenario = questionnaireAnswers.scenario ?? "日常通勤";

  await env.DB.prepare(
    `INSERT INTO reports_tier3 (id, user_id, token_id, scenario, quiz_answers, content, created_at, expire_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      reportId,
      user.userId,
      tokenRow.id,
      scenario,
      JSON.stringify(questionnaireAnswers),
      JSON.stringify(reportContent),
      now,
      expireAt
    )
    .run();

  return new Response(
    JSON.stringify({ id: reportId, content: reportContent, expireAt }),
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
      signal: AbortSignal.timeout(45000),
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
