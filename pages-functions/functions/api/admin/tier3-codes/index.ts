import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAdminAuth } from "../../../_utils";
import type { Ctx } from "../../../_utils";

// GET /api/admin/tier3-codes
// 列出所有兑换码及其状态，方便管理后台追踪哪些码已被使用、使用人是谁
// 返回：{ list, total, unusedCount, usedCount }
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "未授权" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 确保表存在（首次部署时 migration 0027 已建表；此处兜底防漏建）
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS tier3_redeem_codes (
       code TEXT PRIMARY KEY,
       status TEXT NOT NULL DEFAULT 'unused',
       user_id TEXT,
       used_at INTEGER,
       created_at INTEGER NOT NULL
     )`
  ).run();


  const rows = await env.DB.prepare(
    `SELECT c.code, c.status, c.user_id, c.used_at, c.created_at,
            u.phone AS user_phone
     FROM tier3_redeem_codes c
     LEFT JOIN users u ON u.id = c.user_id
     ORDER BY c.created_at DESC, c.code ASC`
  ).all<any>();

  const maskPhone = (p: string | null) =>
    p ? p.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2") : null;


const list = (rows.results || []).map((r) => ({
    code: r.code,
    status: r.status,
    usedBy: r.user_id ?? null,
    usedAt: r.used_at ?? null,
    createdAt: r.created_at,
    userPhone: maskPhone(r.user_phone),
  }));

  const unusedCount = list.filter((r) => r.status === "unused").length;
  const usedCount = list.filter((r) => r.status === "used").length;


  return new Response(
    JSON.stringify({ list, total: list.length, unusedCount, usedCount }),

    { headers: { "Content-Type": "application/json" } }
  );
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
