// 已废弃：登录/注册统一走中枢两个独立接口（/auth/login、/auth/register）。
// 保留该路由只是对未知前端调用方返回 410，避免 404 混淆排查。
export const POST = async () => {
  return new Response(
    JSON.stringify({ error: "接口已废弃，请改用 /api/auth/login 或 /api/auth/register" }),
    { status: 410, headers: { "Content-Type": "application/json" } }
  );
};

export const onRequestPost = (...args) => POST(args[0]);
