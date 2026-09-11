import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";
import type { Ctx } from "../../_utils";

/**
 * 我的美妆档案 — 报告列表接口
 *
 * 固定档案模式：每个用户每个 tier 类型只有一条最新记录。
 *   - tier1：reports_tier1 中 user_id 对应的最新一条
 *   - tier2：reports_tier2 中 user_id 且 unlock_method IN ('ad','code','share') 的最新一条
 *   - tier3：reports_tier3 中 user_id 对应的最新一条（仅返回未过期的，expire_at > now）
 */

type ReportRow =
  | {
      tier: 2;
      id: string;
      scenario: string | null;
      content: string;
      access_type: "share_unlock";
      created_at: number;
      expire_at: null;
    }
  | {
      tier: 3;
      id: string;
      scenario: string | null;
      content: string;
      access_type: "regular";
      created_at: number;
      expire_at: number;
    };

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);

  // ── Tier2：直接查该 user_id 的最新一条 ─────────────────────────────────────
  const tier2Result = await env.DB.prepare(
    `SELECT id, content, scenario, created_at
     FROM reports_tier2
     WHERE user_id = ?
       AND unlock_method IN ('ad', 'code', 'share')
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(user.userId)
    .all();

  // ── Tier3：固定档案模式，仅返回未过期的报告 ──────────────────────────────────
  const tier3Result = await env.DB.prepare(
    `SELECT id, scenario, content, created_at, expire_at
     FROM reports_tier3
     WHERE user_id = ?
       AND expire_at > ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(user.userId, now)
    .all();

  // ── Tier1：查询用户最新的初识报告 ───────────────────────────────────────────
  const tier1Result = await env.DB.prepare(`
    SELECT id, report_data, created_at
    FROM reports_tier1
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 1`).bind(user.userId).first();

  // ── 合并并标注 access_type ─────────────────────────────────────────────────
  const rows: ReportRow[] = [
    ...(tier2Result.results ?? []).map((r: any) => ({
      tier: 2 as const,
      id: r.id,
      scenario: r.scenario ?? null,
      content: r.content,
      access_type: "share_unlock" as const,
      created_at: r.created_at,
      expire_at: null,
    })),
    ...(tier3Result.results ?? []).map((r: any) => ({
      tier: 3 as const,
      id: r.id,
      scenario: r.scenario,
      content: r.content,
      access_type: "regular" as const,
      created_at: r.created_at,
      expire_at: r.expire_at,
    })),
  ];

  // 排序：先 tier 升序（tier2 先展示），再 created_at 降序
  rows.sort((a, b) =>
    a.tier !== b.tier ? a.tier - b.tier : b.created_at - a.created_at
  );

  // ── 构造响应体 ─────────────────────────────────────────────────────────────
  const reports = rows.map((r) => {
    const daysLeft =
      r.access_type === "regular" && r.expire_at !== null
        ? Math.max(0, Math.ceil((r.expire_at - now) / 86400))
        : null;
    return {
      id: r.id,
      tier: r.tier,
      scenario: r.scenario,
      content: r.content,
      access_type: r.access_type,
      createdAt: r.created_at,
      expireAt: r.expire_at,
      daysLeft,
    };
  });

  return new Response(JSON.stringify({ reports, tier1Report: tier1Result ? { id: tier1Result.id, report: tier1Result.report_data, createdAt: tier1Result.created_at } : null }), {
    headers: { "Content-Type": "application/json" },
  });
};


// wrangler v4 compatibility: alias for route discovery
export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
