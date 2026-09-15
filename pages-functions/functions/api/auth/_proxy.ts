// 中枢（chat-ai-auth）透传代理公共工具。
// 账号、登录态、身份资料、密码、邀请码、积分的唯一权威源是中枢（auth-center），
// 本端这些接口只做"纯透传"：把请求原样转发、把中枢返回原样回传，
// 不做任何本地账号/密码/用户表的读写，不缓存、不转换中枢数据。
// 中枢地址优先取 env.AUTH_CENTER_URL（Pages secret/vars 可覆盖），默认生产域名。
export function authCenterBase(env) {
  return env.AUTH_CENTER_URL || "https://auth.meijian.top";
}

// 纯透传中枢响应（状态码、JSON 原样回传），网络异常返回 502。
export async function proxyAuthCenter(method, path, env, body, request, label) {
  try {
    const res = await fetch(authCenterBase(env) + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[" + label + "] proxy error:", err);
    return new Response(JSON.stringify({ error: "网络错误，请稍后重试" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
