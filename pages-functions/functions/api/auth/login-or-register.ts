// POST /api/auth/login-or-register  (代理到 auth-center)
// 账号、登录态以中枢为唯一权威源：不再本地建用户表。
// - 首次使用需带 isRegister:true（可带 inviteCode）；已存在账号则直接登录。
// - 返回中枢签发的 token（JWT），前端保存后用于后续所有请求的 Authorization: Bearer <token>。
// - 404=用户不存在 · 409=走错通道 · 401=token 失效
import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { makeOptionsHandler } from "../../_utils";

const AUTH_CENTER_URL = "https://auth.meijian.top";

export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request } = context;

  let account: string;
  let password: string;
  let isRegister: boolean;
  let inviteCode: string | undefined;
  try {
    const body = (await request.json()) as {
      account?: string;
      password?: string;
      isRegister?: boolean;
      inviteCode?: string;
    };
    account = body.account;
    password = body.password;
    isRegister = body.isRegister === true;
    inviteCode = body.inviteCode;
  } catch {
    return new Response(
      JSON.stringify({ error: "请求体不是合法 JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!account || !password) {
    return new Response(
      JSON.stringify({ error: "请输入账号和密码" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 仅透传中枢认可的字段；中枢负责账号校验、密码、注册去重
  const payload: Record<string, unknown> = { account, password };
  if (isRegister) {
    payload.isRegister = true;
    if (inviteCode) payload.inviteCode = inviteCode;
  }

  try {
    const res = await fetch(AUTH_CENTER_URL + "/api/auth/login-or-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: data.error || "登录失败", status: res.status }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }
    // 中枢返回 { token, isNew }；原样透传给前端作为全局身份
    return new Response(
      JSON.stringify({ token: data.token, isNew: !!data.isNew }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[auth/login-or-register] proxy error:", err);
    return new Response(
      JSON.stringify({ error: "网络错误，请稍后重试" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const OPTIONS = makeOptionsHandler();
export const onRequestPost = async (...args: unknown[]) => {
  return (POST as any)(...args);
};