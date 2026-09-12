import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";

// GET /api/invite/mine
// 代理调用 auth-center，返回当前用户的邀请码和成功邀请人数
// auth-center 地址通过 AUTH_CENTER_URL 环境变量配置，默认使用 https://auth.meijian.top
const AUTH_CENTER_URL = "https://auth.meijian.top";

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 取 Authorization header 中的 token
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "") ?? "";
  if (!token) {
    return new Response(JSON.stringify({ error: "未授权" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 代理调用 auth-center
  try {
    const res = await fetch(AUTH_CENTER_URL + "/api/invite/mine", {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error || "获取邀请信息失败" }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        inviteCode: data.code ?? null,
        invitedCount: data.count ?? 0,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[invite/mine] proxy error:", err);
    return new Response(
      JSON.stringify({ error: "网络错误，请稍后重试" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const onRequestGet = async (...args: unknown[]) => {
  return (GET as any)(...args);
};
