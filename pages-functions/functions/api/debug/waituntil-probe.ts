import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";
import type { Ctx } from "../../_utils";

// 诊断探针：测量 waitUntil 后台任务在真实环境中的存活时长
// GET /api/debug/waituntil-probe?phase=start&seconds=90  → 启动一个 sleep N 秒后写 KV 的任务
// GET /api/debug/waituntil-probe?phase=result            → 读取任务结果
const KV_KEY = "waituntil-probe";

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const phase = url.searchParams.get("phase");

  if (phase === "start") {
    const seconds = Math.min(parseInt(url.searchParams.get("seconds") || "90", 10) || 90, 300);
    const startedAt = Date.now();
    await env.SESSION_KV.put(KV_KEY, JSON.stringify({ startedAt, seconds, result: null, finishedAt: null }), { expirationTtl: 3600 });
    context.waitUntil((async () => {
      await new Promise((r) => setTimeout(r, seconds * 1000));
      try {
        const cur = JSON.parse((await env.SESSION_KV.get(KV_KEY)) || "{}");
        cur.result = "done";
        cur.finishedAt = Date.now();
        await env.SESSION_KV.put(KV_KEY, JSON.stringify(cur), { expirationTtl: 3600 });
      } catch {
        await env.SESSION_KV.put(KV_KEY, JSON.stringify({ startedAt, seconds, result: "error", finishedAt: Date.now() }), { expirationTtl: 3600 });
      }
    })(), { timeout: 120 });
    return new Response(JSON.stringify({ ok: true, startedAt, seconds }), { headers: { "Content-Type": "application/json" } });
  }

  if (phase === "result") {
    const raw = await env.SESSION_KV.get(KV_KEY);
    return new Response(JSON.stringify(raw ? JSON.parse(raw) : { noRecord: true }), { headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "phase 需为 start 或 result" }), { status: 400, headers: { "Content-Type": "application/json" } });
};

export const onRequestGet = async (...args) => { return (GET as any)(...args); };
