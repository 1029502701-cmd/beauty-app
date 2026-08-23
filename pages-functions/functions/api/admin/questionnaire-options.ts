import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAdminAuth } from "../../_utils";
import type { Ctx } from "../../_utils";

// GET  /api/admin/questionnaire-options   — 管理后台读取全部维度选项
// POST /api/admin/questionnaire-options   — 更新某个维度的选项列表（dimension + options数组）
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;

  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "无权限" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  const options: Array<{ dimension: string; options: string[]; updated_at: number | null }> =
    (rows.results ?? []).map((row: any) => ({
      dimension: row.dimension,
      options: (() => { try { return JSON.parse(row.options); } catch { return []; } })(),
      updated_at: row.updated_at,
    }));

  return new Response(JSON.stringify({ options }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;

  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "无权限" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { dimension, options } = body as {
    dimension: string;
    options: string[];
  };

  if (!dimension || !Array.isArray(options)) {
    return new Response(
      JSON.stringify({ error: "缺少 dimension 或 options 字段" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const optionsJson = JSON.stringify(options);
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `INSERT INTO questionnaire_options (dimension, options, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(dimension) DO UPDATE SET options = excluded.options, updated_at = excluded.updated_at`
  ).bind(dimension, optionsJson, now).run();

  return new Response(
    JSON.stringify({ success: true, dimension, options: optionsJson }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestGet = GET;
export const onRequestPost = POST;
