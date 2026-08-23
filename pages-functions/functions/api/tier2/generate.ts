import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth , parseDeepseekJson } from "../../_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier2/generate
// 幂等：若 content 已生成（generation_status=ready）直接返回；否则用 tier1 报告数据调用 DeepSeek 生成
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

  // 2. 幂等：已生成直接返回
  if (tier2Row.generation_status === "ready") {
    try {
      const content = JSON.parse(tier2Row.content);
      return new Response(JSON.stringify({ id: tier2Row.id, content }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // content 损坏，继续生成
    }
  }

  // 3. 没有 source_tier1_report_id，无法生成
  if (!tier2Row.source_tier1_report_id) {
    return new Response(
      JSON.stringify({ error: "缺少 source_tier1_report_id，无法生成报告" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. 查 tier1 报告内容
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = ? LIMIT 1`
  )
    .bind(tier2Row.source_tier1_report_id)
    .first<any>();

  if (!tier1Row) {
    return new Response(
      JSON.stringify({ error: "源 tier1 报告不存在" }),
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

  // 5. 调用 DeepSeek 生成 tier2 内容
  const tier2Content = await callDeepSeekTier2(tier1Report, env);

  if (!tier2Content) {
    return new Response(
      JSON.stringify({ error: "生成失败", retryable: true, message: "AI 服务调用失败，请重试" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // 6. 持久化到 reports_tier2
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE reports_tier2 SET content = ?, generation_status = 'ready', updated_at = ? WHERE id = ?`
  )
    .bind(JSON.stringify(tier2Content), now, tier2Row.id)
    .run();

  return new Response(JSON.stringify({ id: tier2Row.id, content: tier2Content }), {
    headers: { "Content-Type": "application/json" },
  });
};

async function callDeepSeekTier2(tier1Report: Record<string, unknown>, env: Ctx["env"]): Promise<Record<string, unknown> | null> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[tier2/generate] DEEPSEEK_API_KEY not configured");
    return null;
  }

  const prompt = `You are a professional beauty consultant. Based on the following face analysis report, provide detailed makeup and skincare recommendations for each dimension.

Face Analysis Report:
${JSON.stringify(tier1Report, null, 2)}

Please output a JSON object with the following structure (strict JSON only, no markdown):
{
  "coreMakeup": "string - the core makeup style recommendation",
  "reason": "string - why this style suits the user based on their features",
  "style": "string - overall style tag (e.g. 清新自然, 高级冷艳)",
  "keyAreas": ["string array - top 3-5 key makeup areas with specific advice for each"],
  "formula": "string - step-by-step makeup formula combining all recommendations",
  "productRecs": {
    "faceShape": [{"name": "产品名", "desc": "简短推荐理由"}],
    "skinType": [{"name": "产品名", "desc": "简短推荐理由"}],
    "eyebrowShape": [{"name": "产品名", "desc": "简短推荐理由"}],
    "eyeShape": [{"name": "产品名", "desc": "简短推荐理由"}],
    "threeFiveRatio": [{"name": "产品名", "desc": "简短推荐理由"}],
    "symmetry": [{"name": "产品名", "desc": "简短推荐理由"}]
  }
}

- Each dimension in productRecs should have up to 2 product recommendations
- name: specific product or product type name (in Chinese)
- desc: one-sentence reason why it suits the user (in Chinese, 10-20 characters)
- keyAreas must contain detailed advice for each of the 6 dimensions: face shape, skin type, eyebrow shape, eye shape, three courts five eyes, symmetry
- Each keyArea item should follow format: "[Dimension name] specific advice content"
- Be specific and actionable, not generic`;

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
        max_tokens: 800,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const eb = await resp.text().catch(() => "");
      console.error(`[tier2/generate] DeepSeek error ${resp.status}: ${eb.slice(0, 200)}`);
      return null;
    }

    const data: any = await resp.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error("[tier2/generate] DeepSeek empty response");
      return null;
    }

        const report = parseDeepseekJson(raw);
    return report as Record<string, unknown>;
  } catch (e) {
    console.error("[tier2/generate] DeepSeek exception:", e);
    return null;
  }
}

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
