import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";

// GET /api/tier3/report-id?id=<tier3ReportId>
// 个人中心档案详情：按报告 id 取一份专属（tier3）报告的完整内容（仅允许该用户自己的报告）
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) {
    return new Response(JSON.stringify({ error: "缺少报告 id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const row = await env.DB.prepare(
    "SELECT id, scenario, content, created_at, expire_at, face_photo_key FROM reports_tier3 WHERE id = ? AND user_id = ? LIMIT 1"
  )
    .bind(id, user.userId)
    .first<any>();
  if (!row) {
    return new Response(JSON.stringify({ error: "报告不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  let content: unknown = null;
  try {
    content = JSON.parse(row.content);
  } catch {
    content = null;
  }
  const now = Math.floor(Date.now() / 1000);
  return new Response(
    JSON.stringify({
      id: row.id,
      content,
      scenario: row.scenario || null,
      createdAt: row.created_at ?? null,
      expireAt: row.expire_at ?? null,
      expired: typeof row.expire_at === "number" ? row.expire_at <= now : false,
      photoUrl: row.face_photo_key
        ? "/api/r2-proxy?key=" + encodeURIComponent(row.face_photo_key) + "&bucket=temp"
        : null,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestGet = GET;
