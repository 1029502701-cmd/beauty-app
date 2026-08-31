import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { verifyJwt } from "../../_utils";

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const auth = request.headers.get("Authorization");
  return new Response(JSON.stringify({
    hasAuth: !!auth,
    authStartsWithBearer: auth?.startsWith("Bearer ") ?? false,
    hasJwtSecret: !!env.AUTH_JWT_SECRET,
    secretLength: env.AUTH_JWT_SECRET?.length ?? 0,
    token: auth ? auth.slice(7) : null,
  }), { headers: { "Content-Type": "application/json" } });
};
export const onRequestGet = async (...args) => (GET as any)(...args);
