import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { generateId } from "../../_utils";
import type { Ctx } from "../../_utils";

// 微信授权登录（App 端，使用微信开放平台）
export const POST: FrameworkCallbackOptions["POST"] = async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { code } = body as { code: string }; // wx.login() 获取的 code

  // TODO: 用 code 换取微信 openid / unionid
  // 逻辑：
  // 1. 查询 DB：wechat_unionid 是否已绑定某 user
  //    - 是 → 检查该 user 的 phone 是否已绑定当前 wechat_openid
  //      - 是 → 正常登录
  //      - 否 → 返回冲突提示（unionid 已绑定其他手机号），前端引导解绑或换号
  // 2. wechat_unionid 未绑定 → 检查 wechat_openid 是否已注册
  //    - 已注册 → 正常登录
  //    - 未注册 → 创建 users 记录（phone 为空），返回 needPhoneBind: true，引导绑定手机号
  // 3. 生成 session，写入 KV

  return new Response(
    JSON.stringify({
      sessionId: generateId(),
      needPhoneBind: false,
      // conflictWithPhone: "138****1234", // 冲突时的提示
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};

// wrangler v4 compatibility: alias for route discovery
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};




