import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";

export const GET: FrameworkCallbackOptions["GET"] = async () => {
  return new Response("hello from test");
};
