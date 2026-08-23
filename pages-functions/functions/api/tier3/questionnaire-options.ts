import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";

// GET /api/tier3/questionnaire-options
// 公开接口：返回全部4个维度的选项配置，前端渲染问卷用（无需登录）
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { env } = context;

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS questionnaire_options (
      dimension TEXT PRIMARY KEY,
      options TEXT NOT NULL,
      updated_at INTEGER
    )
  `).run();

  const rows = await env.DB.prepare(
    "SELECT dimension, options, updated_at FROM questionnaire_options ORDER BY dimension"
  ).all<any>();

  // 将结果组装为 { dimension: options[] } 的 Map 结构
  const optionsMap: Record<string, string[]> = {};
  for (const row of rows.results ?? []) {
    try {
      optionsMap[row.dimension] = JSON.parse(row.options);
    } catch {
      optionsMap[row.dimension] = [];
    }
  }

  return new Response(JSON.stringify({ options: optionsMap }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestGet = GET;
