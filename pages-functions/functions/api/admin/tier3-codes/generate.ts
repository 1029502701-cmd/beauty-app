import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAdminAuth, generateId } from "../../../_utils";
import type { Ctx } from "../../../_utils";

// POST /api/admin/tier3-codes/generate
// 管理后台生成 N 个兑换码（不经过积分/token，直接授权解锁专属报告）
// 入参：{ count: number }
// 返回：{ codes: string[], count: number }
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 排除 0/O/1/I 易混淆字符

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return code;
}

export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "未授权" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let count: number;
  try {
    const body = await request.json();
    count = Math.max(1, Math.min(100, Math.floor(Number(body?.count ?? 1))));
  } catch {
    count = 1;
  }

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS tier3_redeem_codes (
       code TEXT PRIMARY KEY,
       status TEXT NOT NULL DEFAULT 'unused',
       user_id TEXT,
       used_at INTEGER,
       created_at INTEGER NOT NULL
     )`
  ).run();

  const now = Math.floor(Date.now() / 1000);
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = randomCode();
    // 碰撞重抽
    const exists = await env.DB.prepare(
      `SELECT 1 FROM tier3_redeem_codes WHERE code = ? LIMIT 1`
    ).bind(code).first();
    if (exists) {
      code = code.slice(0, 5) + Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    }
    await env.DB.prepare(
      `INSERT INTO tier3_redeem_codes (code, status, created_at) VALUES (?, 'unused', ?)`
    ).bind(code, now).run();
    codes.push(code);
  }

  return new Response(
    JSON.stringify({ codes, count: codes.length }),
    { headers: { "Content-Type": "application/json" } }
  );
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};
