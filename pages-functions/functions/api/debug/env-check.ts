import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { env } = context;
  const keys = Object.keys(env).filter(k => k.includes('SECRET') || k.includes('KEY') || k.includes('TOKEN') || k.includes('JWT'));
  return new Response(JSON.stringify({ availableSecrets: keys }), { headers: { "Content-Type": "application/json" } });
};
export const onRequestGet = async (...args) => (GET as any)(...args);
