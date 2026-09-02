import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";

export const onRequest: FrameworkCallbackOptions["onRequest"] = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  // Let API routes through to their dedicated handlers
  if (url.pathname.startsWith("/api/")) {
    return null;
  }

  // First try to serve as static asset
  try {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 200) return asset;
  } catch {}
  // Then check if it's a known SPA route -> serve index.html
  const spaRoutes = ["/", "/tier1-result", "/capture", "/home", "/report", "/influencer-apply", "/admin/login", "/admin/dashboard"];
  const isKnownSpaRoute = spaRoutes.includes(url.pathname) || url.pathname.startsWith("/report/");
  if (isKnownSpaRoute) {
    try {
      const indexReq = new Request(new URL("/", request.url));
      const indexResp = await env.ASSETS.fetch(indexReq);
      if (indexResp.status === 200) return indexResp;
    } catch {}
  }
  return new Response("Not found", { status: 404 });
};