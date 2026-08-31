import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { env } = context;
  return new Response(JSON.stringify({
    hasJwtSecret: !!env.AUTH_JWT_SECRET,
    secretLength: env.AUTH_JWT_SECRET?.length ?? 0,
  }), { headers: { "Content-Type": "application/json" } });
};
export const onRequestGet = async (...args) => (GET as any)(...args);
