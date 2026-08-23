import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { env } = context;
  const key = "face-photos/user-test/tier1-test-001.jpg";
  const obj = await env.R2_TEMP.get(key);
  return new Response(JSON.stringify({
    exists: !!obj,
    hasBody: obj ? "body" in obj : false,
    hasArrayBuffer: obj ? typeof obj.arrayBuffer : "n/a",
    key: obj?.key,
    size: obj?.size,
  }));
};
export const onRequestGet = async (...args) => (GET as any)(...args);
