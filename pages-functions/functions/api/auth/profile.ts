// GET/PUT /api/auth/profile —— 纯透传到中枢 /api/auth/profile（补全/更新性别、年龄段）。
// 中枢签发的 JWT 本身已带 gender/age_range claim；本端不本地维护用户表副本。
// 统一鉴权：Authorization: Bearer <中枢JWT>，直接透传给中枢。
import { proxyAuthCenter, authCenterBase } from "./_proxy";
import { extractJwt } from "../../_utils";


export const GET = async (context) => {
  const { request, env } = context;
  const jwt = extractJwt(request);
  try {
    const res = await fetch(authCenterBase(env) + "/api/auth/profile", {
      method: "GET",
      headers: { Authorization: jwt },
    });
    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: res.status === 401 || res.status === 403 ? res.status : res.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[auth/profile GET] proxy error:", err);
    return new Response(JSON.stringify({ error: "网络错误，请稍后重试" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const PUT = async (context) => {
  const { request, env } = context;
  const jwt = extractJwt(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "请求体不是合法 JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const payload = {
    ...(body?.gender ? { gender: body.gender } : {}),
    ...(body?.age_range ? { age_range: body.age_range } : {}),
  };
  return await proxyAuthCenter("PUT", "/api/auth/profile", env, payload, request, "auth/profile PUT");
};

export const onRequestGet = (...args) => GET(args[0]);
export const onRequestPut = (...args) => PUT(args[0]);
