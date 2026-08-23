import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth, beijingDate } from "../../_utils";
import type { Ctx } from "../../_utils";

/**
 * 我的美妆档案 — 报告列表接口
 *
 * 过滤规则（满足任一即返回）：
 *   1. 常规：reports_tier3 中 expire_at > now（创建后 30 天内有效）
 *   2. 临时：reports_tier2 中 unlock_method IN ('ad','code','share') 且 created_at
 *            落在今天北京时间 00:00–24:00 内（当天分享解锁产生的报告）
 *
 * 排序：先按 tier 升序（tier2 先于 tier3），再按 created_at 降序
 *
 * 返回字段变化（对比原 stub）：
 *   - 新增 access_type: 'regular' | 'share_unlock'（前端用于区分来源）
 *   - 保留 daysLeft（仅 regular 类型有意义，share_unlock 设为 null）
 *
 * ⚠️ 与 scheduled-worker 的一致性说明：
 *   - scheduled-worker 使用 expire_at < now 清理过期 tier3 记录
 *   - 本接口使用 expire_at > now 作为常规过滤条件
 *   - 两边都基于「创建时写入的 expire_at」字段，30 天定义完全一致 ✅
 *   - tier2 无 expire_at，由本接口当日 created_at 过滤，无需 scheduled-worker 参与
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
  console.log("[mine] context keys=", Object.keys(context), "request=", typeof context.request); const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  const today = beijingDate(); // YYYY-MM-DD，北京时间

  // ── Tier2：当天分享解锁产生的报告 ──────────────────────────────────────────
  // SQL 层已限定 created_at >= 今日北京时间 00:00 (Unix 秒)
  // 注：D1 不支持 TIMESTAMP WITH TIME ZONE 转换，故在 JS 侧用 beijingDate()
  // 取当日日期，再反向算出对应 Unix 时间戳作为下界；上界用今天 24:00 即明天 00:00
  const todayStartUnix = Math.floor(
    new Date(today + "T00:00:00+08:00").getTime() / 1000
  );
  const todayEndUnix = todayStartUnix + 24 * 60 * 60;

  const tier2Result = await env.DB.prepare(
    `SELECT id, content, scenario, created_at
     FROM reports_tier2
     WHERE user_id = ?
       AND unlock_method IN ('ad', 'code', 'share')
       AND created_at >= ?
       AND created_at < ?`
  )
    .bind(user.userId, todayStartUnix, todayEndUnix)
    .all();

  // ── Tier3：常规 30 天有效报告 ──────────────────────────────────────────────
  // expire_at = created_at + 30天（写入时确定），与 scheduled-worker 清理条件一致
  const tier3Result = await env.DB.prepare(
    `SELECT id, scenario, content, created_at, expire_at
     FROM reports_tier3
     WHERE user_id = ? AND expire_at > ?
     ORDER BY created_at DESC`
  )
    .bind(user.userId, now)
    .all();

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

  return new Response(JSON.stringify({ reports }), {
    headers: { "Content-Type": "application/json" },
  });
};


// wrangler v4 compatibility: alias for route discovery
export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
















