import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, enrichTier3ProductRecs } from "../../_utils";
import type { Ctx } from "../../_utils";

// POST /api/tier3/enrich-products
// 两步设计之 Step 2：专属报告二层界面进入时按需补全淘宝商品（图片/链接/价格）。
// - 入参 { reportId }：要补全的那份专属报告 id；
// - 仅补该用户自己的报告（user_id 校验）；
// - 幂等：已含 itemUrl 的商品跳过，重复进入二层界面不会重复调淘宝；
// - 预算：单品 4s + 整段 8s，超时/失败不影响报告主体，返回 enriched 标记。
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  try {
    const { request, env } = context as Ctx;
    const user = await requireAuth(request, env);
    if (!user) {
      return new Response(JSON.stringify({ error: "未登录" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let reportId: string | undefined;
    try {
      const body = (await request.json()) as { reportId?: string };
      reportId = body.reportId;
    } catch {
      reportId = undefined;
    }
    if (!reportId) {
      return new Response(
        JSON.stringify({ error: "缺少 reportId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 仅允许补全该用户自己的报告
    const row = await env.DB.prepare(
      "SELECT id, content FROM reports_tier3 WHERE id = ? AND user_id = ? LIMIT 1"
    )
      .bind(reportId, user.userId)
      .first<any>();
    if (!row) {
      return new Response(
        JSON.stringify({ error: "报告不存在", notFound: true }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    let reportContent: Record<string, unknown> | null = null;
    try {
      reportContent = JSON.parse(row.content);
    } catch {
      reportContent = null;
    }
    if (!reportContent || typeof reportContent !== "object") {
      return new Response(
        JSON.stringify({ error: "报告内容解析失败", notFound: true }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 按需补全未命中商品；有变化才落库（幂等 + 避免无意义写）
    let changed = false;
    try {
      changed = await enrichTier3ProductRecs(reportContent, env, 8000);
    } catch (e) {
      console.warn("[tier3/enrich-products] enrichment failed:", e);
    }
    if (changed) {
      await env.DB.prepare("UPDATE reports_tier3 SET content = ? WHERE id = ?")
        .bind(JSON.stringify(reportContent), reportId)
        .run();
    }

    // 返回最新商品数据，供前端二层界面即时渲染（无需再查一次 report-id）
    return new Response(
      JSON.stringify({
        reportId,
        enriched: changed,
        productRecs: (reportContent as Record<string, unknown>).productRecs || null,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[tier3/enrich-products] UNCAUGHT:", e);
    return new Response(
      JSON.stringify({ error: "服务器内部错误", retryable: true }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const onRequestPost = POST;
