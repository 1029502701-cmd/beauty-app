// GET/POST /api/profile/facts —— 纯透传到中枢 /api/profile/facts（用户画像标签词表）。
// 统一鉴权：Authorization: Bearer <中枢JWT>，直接透传给中枢，本端不做转换/缓存。
// 写入时机：本端在"分析/生成结果确定之后"（tier1/tier2 生成成功处）才调用本接口写标签，
// 不要在用户还没看到结果前就写。
import { proxyAuthCenter } from "../auth/_proxy";

export const GET = async (context) => {
  const { request, env } = context;
  return await proxyAuthCenter("GET", "/api/profile/facts", env, null, request, "profile/facts GET");
};

export const POST = async (context) => {
  const { request, env } = context;
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
    source_project: body?.source_project || "美妆app",
    facts: Array.isArray(body?.facts) ? body.facts : [],
  };
  if (payload.facts.length === 0) {
    return new Response(JSON.stringify({ error: "缺少 facts" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  return await proxyAuthCenter("POST", "/api/profile/facts", env, payload, request, "profile/facts POST");
};

export const onRequestGet = (...args) => GET(args[0]);
export const onRequestPost = (...args) => POST(args[0]);
