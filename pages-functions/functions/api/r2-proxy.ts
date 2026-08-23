import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";

// GET /api/r2-proxy?key={r2Key}&bucket={temp|perm}
// 代理读取 R2_TEMP 或 R2_PERM 中的文件，返回给调用方（如 DashScope API、前端 img src）
// bucket 默认为 temp（兼容旧调用方）
export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const bucketParam = url.searchParams.get("bucket") || "temp";

  if (!key) {
    return new Response(JSON.stringify({ error: "missing key parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const bucket = bucketParam === "perm" ? env.R2_PERM : env.R2_TEMP;

  try {
    const obj = await bucket.get(key);
    if (!obj) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentType = obj.httpMetadata?.contentType || "application/octet-stream";

    let body: Uint8Array;
    if ("arrayBuffer" in obj && typeof obj.arrayBuffer === "function") {
      body = new Uint8Array(await obj.arrayBuffer());
    } else {
      return new Response(JSON.stringify({ error: "cannot read body" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[r2-proxy] Error:", e);
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const onRequestGet = async (...args) => (GET as any)(...args);
