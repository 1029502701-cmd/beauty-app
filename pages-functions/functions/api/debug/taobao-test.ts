import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import { requireAuth } from "../../_utils";
import { findProductByKeyword } from "../_taobao";
import type { Ctx } from "../../_utils";

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) return new Response(JSON.stringify({ error: "未登录" }), { status: 401 });
  
  const url = new URL(request.url);
  const keyword = url.searchParams.get("q") || "NARS 修容粉";
  
  const result: any = {
    keyword,
    hasAppKey: !!env.TAOBAO_APP_KEY,
    hasAppSecret: !!env.TAOBAO_APP_SECRET,
    hasPid: !!env.TAOBAO_PID,
    appKeyPrefix: env.TAOBAO_APP_KEY ? env.TAOBAO_APP_KEY.substring(0, 4) + "..." : "MISSING",
    pid: env.TAOBAO_PID || "MISSING",
  };
  
  try {
    const product = await findProductByKeyword(keyword, env);
    result.found = !!product;
    if (product) {
      result.product = {
        title: product.title,
        price: product.price,
        hasImage: !!(product.imageUrl && product.imageUrl.length > 10),
        hasLink: !!(product.itemUrl && product.itemUrl.length > 10),
        imageUrl: product.imageUrl ? product.imageUrl.substring(0, 80) : "MISSING",
        itemUrl: product.itemUrl ? product.itemUrl.substring(0, 80) : "MISSING",
      };
    }
  } catch (e) {
    result.error = String(e);
  }
  
  return new Response(JSON.stringify(result, null, 2), { headers: { "Content-Type": "application/json" } });
};

export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
