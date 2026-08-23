import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  return new Response(JSON.stringify({ message: "hello from get-test" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestGet = async (...args) => GET(args[0]);
