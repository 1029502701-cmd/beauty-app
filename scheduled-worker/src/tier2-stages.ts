/**
 * scheduled-worker 版分阶段生成引擎（自包含副本，逻辑与 pages-functions/functions/api/_tier2_stages.ts 一致）。
 * 用途：兜底推进卡住的 tier2 报告（用户离开页面后，每分钟 cron 推进一个阶段，最终完成）。
 * 注意：Pages 与 Worker 是两个独立部署包，无法共享模块，因此此处为副本；修改阶段逻辑时请同步两处。
 *
 * 差异：
 * - 无 SESSION_KV（淘宝结果不做 KV 缓存，直接调 API）
 * - 淘宝检索为简化版（单次搜索 + 相关性过滤，取首个结果）
 * - 精选商品（curated）从线上站点 /_curated-products.json 拉取（15s 限时，失败跳过）
 */

export interface WorkerEnv {
  DB: D1Database;
  R2_TEMP: R2Bucket;
  R2_PERM: R2Bucket;
  DASHSCOPE_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  TAOBAO_APP_KEY?: string;
  TAOBAO_APP_SECRET?: string;
  TAOBAO_PID?: string;
}

export interface Tier2Progress {
  ts: number;
  stage: string;
  standalone: boolean;
  facePhotoKey?: string | null;
  textDesc?: string;
  faceAnalysis?: Record<string, unknown>;
  steps?: Record<string, Record<string, unknown>>;
  summary?: { coreConclusion: string; style: string; overallTips: string };
  enriched?: boolean;
}

export const TIER2_STEP_DEFS = [
  { step: "01", label: "底妆", key: "skinType", emoji: "🧴", basedOn: "skinType（肤质状态）" },
  { step: "02", label: "眉形", key: "eyebrowShape", emoji: "✏️", basedOn: "eyebrowShape（眉毛形状）" },
  { step: "03", label: "眼妆", key: "eyeShape", emoji: "👁", basedOn: "eyeShape（眼型）与 threeFiveRatio（三庭比例）" },
  { step: "04", label: "腮红", key: "symmetry", emoji: "🌸", basedOn: "symmetry（面部对称度）" },
  { step: "05", label: "修容", key: "faceShape", emoji: "🪞", basedOn: "faceShape（脸型）" },
  { step: "06", label: "唇妆", key: "lip", emoji: "💄", basedOn: "personaTags（风格标签）与 highlight（亮点）" },
];

export function readTier2Progress(row: { content?: string | null } | null | undefined): Tier2Progress | null {
  if (!row?.content) return null;
  try {
    const parsed = JSON.parse(row.content);
    return parsed?._gen && typeof parsed._gen === "object" ? (parsed._gen as Tier2Progress) : null;
  } catch {
    return null;
  }
}

export function defaultFaceAnalysis(): Record<string, unknown> {
  return {
    faceShape: "圆脸", skinType: "混合肌", eyebrowShape: "一字眉",
    eyeShape: "杏眼", threeFiveRatio: "三庭均衡型", symmetry: "高对称度",
    personaTags: "温柔知性风", highlight: "你的五官比例协调，笑起来很有感染力",
    suggestions: ["根据你的面部特征，个性化妆容建议正在生成中"],
  };
}

// ---------- 通用工具 ----------

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
  } catch {
    return null;
  }
}

function b64FromBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + 8192, bytes.length)));
  }
  return btoa(bin);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

async function qwenVisionCall(env: WorkerEnv, prompt: string, imageB64DataUrl: string, maxTokens: number, timeoutMs: number): Promise<string | null> {
  const key = env.DASHSCOPE_API_KEY;
  if (!key) return null;
  try {
    const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "qwen-vl-max",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageB64DataUrl } }] }],
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) return null;
    const data: any = await resp.json().catch(() => null);
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

// 简易 JSON 解析（与 Pages 版 parseDeepseekJson 等价：剥离 markdown 包裹后取 {...} 段）
function parseLooseJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "");
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function deepseekJsonCall(env: WorkerEnv, prompt: string, maxTokens: number, timeoutMs: number, label: string): Promise<Record<string, unknown> | null> {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) return null;
  try {
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], max_tokens: maxTokens, temperature: 0.3 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!resp.ok) {
      console.error(label, "DeepSeek HTTP", resp.status);
      return null;
    }
    const data: any = await resp.json().catch(() => null);
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return null;
    return parseLooseJson(raw);
  } catch (e) {
    console.error(label, "DeepSeek exception:", e);
    return null;
  }
}

// ---------- 淘宝商品检索（简化版，无 KV 缓存） ----------

async function md5Upper(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = new Uint8Array(await crypto.subtle.digest("MD5", data));
  return Array.from(hash).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

interface TbProduct { imageUrl: string; price: number; itemUrl: string; shopTitle?: string; brandName?: string; title: string; }

async function searchTaobao(env: WorkerEnv, keyword: string, limit = 10): Promise<TbProduct[]> {
  const appKey = env.TAOBAO_APP_KEY;
  const appSecret = env.TAOBAO_APP_SECRET;
  if (!appKey || !appSecret) return [];
  const pid = env.TAOBAO_PID || "";
  const m = pid.match(/_(\d+)$/);
  const adzoneId = m ? m[1] : "";
  const params: Record<string, string> = {
    app_key: appKey,
    method: "taobao.tbk.dg.material.optional.upgrade",
    timestamp: String(Math.floor(Date.now() / 1000)),
    v: "2.0",
    sign_method: "md5",
    q: keyword,
    page_no: "1",
    page_size: String(limit),
    fields: "num_iid,title,pict_url,small_images,resale_price,final_promotion_price,item_url,shop_title,seller_nick,coupon_info,click_url,short_title,brand_name,volume,user_type,zk_final_price",
  };
  if (adzoneId) params.adzone_id = adzoneId;
  const sortedKeys = Object.keys(params).sort();
  let pre = appSecret;
  for (const k of sortedKeys) pre += k + params[k];
  pre += appSecret;
  const sign = await md5Upper(pre);
  const url = new URL("https://eco.taobao.com/router/rest");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("sign", sign);
  try {
    const resp = await fetch(url.toString(), { headers: { "User-Agent": "BeautyApp/1.0" }, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];
    const xml = await resp.text();
    const products: TbProduct[] = [];
    const itemRegex = /<item_basic_info>([\s\S]*?)<\/item_basic_info>[\s\S]*?<item_id>([^<]*)<\/item_id>[\s\S]*?<price_promotion_info>[\s\S]*?<zk_final_price>([^<]*)<\/zk_final_price>[\s\S]*?<\/price_promotion_info>[\s\S]*?<publish_info>[\s\S]*?<click_url>([^<]*)<\/click_url>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const pick = (tag: string) => {
        const mm = itemXml.match(new RegExp("<" + tag + ">([\\s\\S]*?)<\\/" + tag + ">"));
        return mm ? mm[1].trim() : "";
      };
      const pict = pick("pict_url");
      const small = pick("small_images");
      const images = (small ? small.split(";") : []).filter(Boolean);
      const title = pick("title");
      if (!title) continue;
      products.push({
        imageUrl: images[0] || pict,
        price: parseFloat(pick("zk_final_price") || pick("resale_price")) || 0,
        itemUrl: match[4],
        shopTitle: pick("shop_title"),
        brandName: pick("brand_name"),
        title,
      });
      if (products.length >= limit) break;
    }
    return products;
  } catch (e) {
    console.warn("[tier2/worker:taobao] search failed:", e);
    return [];
  }
}

async function findProductByKeyword(name: string, env: WorkerEnv): Promise<TbProduct | null> {
  if (!name || name.trim().length < 2) return null;
  const kw = name.trim();
  const products = await searchTaobao(env, kw, 10);
  if (products.length === 0) return null;
  const firstToken = kw.split(/[\s/]+/)[0].toLowerCase();
  const relevant = products.filter((p) => p.title.toLowerCase().includes(firstToken) && !/试用|小样|赠品/.test(p.title));
  return (relevant[0] || products[0]) || null;
}

// 精选商品：从线上静态站点拉取（15s 限时，失败跳过）
let curatedCache: unknown[] | null = null;
async function loadCuratedProducts(env: WorkerEnv): Promise<any[]> {
  if (curatedCache !== null) return curatedCache;
  try {
    const resp = await fetch("https://beauty-api-pages.pages.dev/_curated-products.json", { signal: AbortSignal.timeout(15000) });
    if (resp.ok) {
      const data: any = await resp.json();
      curatedCache = data.products || [];
      return curatedCache;
    }
  } catch {
    console.warn("[tier2/worker:curated] load failed");
  }
  curatedCache = [];
  return curatedCache;
}

async function findCuratedProduct(productName: string, env: WorkerEnv): Promise<any | null> {
  const name = productName.trim().toLowerCase();
  if (!name) return null;
  const products = await loadCuratedProducts(env);
  for (const cp of products) {
    const tagMatch = cp.tags && cp.tags.some((t: string) => name.includes(String(t).toLowerCase()));
    const kwMatch = cp.keywords && cp.keywords.some((k: string) => name.includes(String(k).toLowerCase()) || String(k).toLowerCase().includes(name));
    if (tagMatch || kwMatch) return cp;
  }
  return null;
}

// ---------- 提示词（与 Pages 版一致） ----------

const VISION_PROMPT = `Please observe this front-facing face photo and describe these visual features in Chinese natural language (no enum labels): face shape contour, eyebrow shape/density, eye morphology, skin condition, three-court proportions, facial symmetry. One paragraph per feature.`;

function buildAnalysisPrompt(textDesc: string): string {
  return `You are a professional beauty consultant. Based on the following face description, select exactly one option from each category and provide personalized advice.

[Face Description]
${textDesc || "（视觉描述不可用，请基于一般化建议输出）"}

faceShape: 鹅蛋脸, 圆脸, 方脸, 长脸, 菱形脸, 心形脸, 倒三角脸
skinType: 干性肌, 油性肌, 混合肌, 中性肌, 敏感肌
eyebrowShape: 标准眉, 柳叶眉, 挑眉, 平眉, 一字眉, 拱形眉, 细眉
eyeShape: 丹凤眼, 桃花眼, 圆眼, 凤眼, 杏眼, 下垂眼, 瑞凤眼
threeFiveRatio: 三庭均衡型, 上庭偏长型, 中庭偏长型, 下庭偏长型, 上庭偏短型, 下庭偏短型
symmetry: 高对称度, 中等对称度, 自然微不对称, 明显不对称
personaTags: 温柔知性风, 元气少女风, 干练商务风, 韩系清新风, 熟龄优雅风, 个性酷飒风, 甜美可爱风, 清冷气质风

Output strict JSON only, with these exact keys:
{
  "faceShape": "one of the options above",
  "skinType": "one of the options above",
  "eyebrowShape": "one of the options above",
  "eyeShape": "one of the options above",
  "threeFiveRatio": "one of the options above",
  "symmetry": "one of the options above",
  "personaTags": "one of the options above",
  "highlight": "A one-sentence catchy compliment in Chinese, 10-20 characters",
  "suggestions": ["3-5 makeup tips in Chinese"]
}`;
}

function buildStepPrompt(def: (typeof TIER2_STEP_DEFS)[number], faceAnalysis: Record<string, unknown>): string {
  return `You are a professional beauty consultant writing ONE makeup step for a specific user.

Face Analysis Report:
${JSON.stringify(faceAnalysis, null, 2)}

Write ONLY the step "${def.label}" (key: ${def.key}), based on ${def.basedOn}.
Personalize to THIS user (use '你是X' form, e.g. '你是圆脸').

Output strict JSON only (no markdown wrapping):
{
  "analysis": "<personalized analysis for THIS user, Chinese>",
  "why": "<why this approach fits, Chinese>",
  "steps": "<step-by-step instructions separated by arrows (→), Chinese>",
  "tips": "<warnings separated by Chinese semicolons (;), Chinese>",
  "products": [{"name":"real product name","desc":"reason for this user","price":"price"}]
}
Include 2-3 products in products.`;
}

function buildSummaryPrompt(faceAnalysis: Record<string, unknown>): string {
  return `You are a professional beauty consultant. Six makeup steps (底妆/眉形/眼妆/腮红/修容/唇妆) have been planned for this user based on the face analysis below.
Face Analysis Report:
${JSON.stringify(faceAnalysis, null, 2)}

Output strict JSON only:
{
  "coreConclusion": "1-2 sentence overall style conclusion in Chinese",
  "style": "a style tag like 温柔知性风",
  "overallTips": "1-2 sentence overall makeup advice in Chinese"
}`;
}

function stepFallback(def: (typeof TIER2_STEP_DEFS)[number]): Record<string, unknown> {
  return {
    analysis: `结合你的${def.basedOn}特征，这一步有稳妥的通用做法。`,
    why: "通用安全方案，适合多数肤质与场合。",
    steps: "清洁打底 → 少量多次上妆 → 局部修正 → 定妆收尾",
    tips: "选择适合自己肤色的色号; 先做敏感测试再全脸使用",
    products: [],
    _fallback: true,
  };
}

// ---------- 阶段执行器（与 Pages 版一致；每个只推进一个阶段，≤25s） ----------

async function runVisionStage(env: WorkerEnv, prog: Tier2Progress): Promise<boolean> {
  prog.textDesc = "";
  if (prog.facePhotoKey) {
    try {
      const obj = await withTimeout(env.R2_TEMP.get(prog.facePhotoKey), 5000);
      if (obj) {
        const buf = await withTimeout(obj.arrayBuffer(), 5000);
        if (buf) {
          const dataUrl = "[image omitted]" + b64FromBytes(buf);
          const desc = await qwenVisionCall(env, VISION_PROMPT, dataUrl, 500, 15000);
          prog.textDesc = desc || "";
        }
      }
    } catch {
      // 照片读取失败：用空描述继续
    }
  }
  prog.stage = "analysis";
  return true;
}

async function runAnalysisStage(env: WorkerEnv, prog: Tier2Progress): Promise<boolean> {
  const base = defaultFaceAnalysis();
  const parsed = await deepseekJsonCall(env, buildAnalysisPrompt(prog.textDesc || ""), 500, 15000, "[tier2/worker:analysis]");
  const fa: Record<string, unknown> = { ...base };
  if (parsed) {
    for (const k of ["faceShape", "skinType", "eyebrowShape", "eyeShape", "threeFiveRatio", "symmetry", "personaTags", "highlight", "suggestions"]) {
      if (parsed[k] !== undefined && parsed[k] !== null && parsed[k] !== "") fa[k] = parsed[k];
    }
  }
  prog.faceAnalysis = fa;
  prog.stage = "step1";
  return true;
}

async function runStepStage(env: WorkerEnv, prog: Tier2Progress, idx: number): Promise<boolean> {
  const def = TIER2_STEP_DEFS[idx];
  prog.steps = prog.steps || {};
  let data: Record<string, unknown> | null = null;
  if (env.DEEPSEEK_API_KEY) {
    data = await deepseekJsonCall(env, buildStepPrompt(def, prog.faceAnalysis || defaultFaceAnalysis()), 700, 25000, `[tier2/worker:step${def.step}]`);
  }
  prog.steps[def.key] = data && Array.isArray(data.products) ? data : stepFallback(def);
  prog.stage = idx === TIER2_STEP_DEFS.length - 1 ? "summary" : `step${idx + 2}`;
  return true;
}

async function runSummaryStage(env: WorkerEnv, prog: Tier2Progress): Promise<boolean> {
  const fa = prog.faceAnalysis || defaultFaceAnalysis();
  let s: Record<string, unknown> | null = null;
  if (env.DEEPSEEK_API_KEY) {
    s = await deepseekJsonCall(env, buildSummaryPrompt(fa), 400, 15000, "[tier2/worker:summary]");
  }
  prog.summary = {
    coreConclusion: str(s?.coreConclusion) || str(fa.highlight) || "你的专属妆容风格方案已生成",
    style: str(s?.style) || str(fa.personaTags) || "温柔知性风",
    overallTips: str(s?.overallTips) || (Array.isArray(fa.suggestions) ? str(fa.suggestions[0]) : ""),
  };
  prog.stage = "enrich";
  return true;
}

async function runEnrichStage(env: WorkerEnv, prog: Tier2Progress): Promise<boolean> {
  const t0 = Date.now();
  for (const def of TIER2_STEP_DEFS) {
    const stepData = (prog.steps || {})[def.key];
    const items = stepData && Array.isArray(stepData.products) ? (stepData.products as Array<Record<string, unknown>>) : [];
    for (const item of items) {
      if (!item || typeof item !== "object" || !item.name || Date.now() - t0 > 18000) continue;
      try {
        const product = await findProductByKeyword(String(item.name), env);
        if (product) {
          item.imageUrl = product.imageUrl;
          item.price = product.price;
          item.itemUrl = product.itemUrl;
          item.shopTitle = product.shopTitle;
          item.brandName = product.brandName;
        }
        const curated = await findCuratedProduct(String(item.name), env);
        if (curated) {
          item.curatedProduct = {
            name: curated.name,
            price: curated.price,
            imageUrl: curated.imageUrl,
            itemUrl: curated.itemUrl,
            shopTitle: curated.shopTitle,
            reason: (curated as any).reason || undefined,
          };
        }
      } catch {
        // 单品补全失败不阻断
      }
    }
  }
  prog.enriched = true;
  prog.stage = "reasons";
  return true;
}

async function runReasonsStage(env: WorkerEnv, prog: Tier2Progress): Promise<boolean> {
  // 推荐理由：收集目标商品，一次 DS 调用（15s 限时）；失败用 desc 兜底
  const targets: Array<{ name: string; brand: string; price: string }> = [];
  const slots: Array<{ dim: string; idx: number; isCurated: boolean }> = [];
  for (const def of TIER2_STEP_DEFS) {
    const items = ((prog.steps || {})[def.key] || {}).products as Array<Record<string, unknown>>;
    if (!Array.isArray(items)) continue;
    items.forEach((item, idx) => {
      if (!item || typeof item !== "object") return;
      const cp = item.curatedProduct as Record<string, unknown> | undefined;
      if (cp) {
        targets.push({ name: str(cp.name), brand: str(cp.shopTitle), price: cp.price ? String(cp.price) : "" });
        slots.push({ dim: def.key, idx, isCurated: true });
      }
      targets.push({ name: str(item.name), brand: str(item.brandName), price: item.price ? String(item.price) : "" });
      slots.push({ dim: def.key, idx, isCurated: false });
    });
  }
  let reasons: Record<string, string> = {};
  if (targets.length > 0 && env.DEEPSEEK_API_KEY) {
    reasons = (await withTimeout(generateProductReasonsWorker(targets, (prog.faceAnalysis || {}) as Record<string, unknown>, env), 15000)) || {};
    slots.forEach((s, i) => {
      const item = ((prog.steps || {})[s.dim] || {}).products?.[s.idx] as Record<string, unknown> | undefined;
      if (!item) return;
      const genReason = str(reasons[i]).trim();
      const cp = s.isCurated ? (item.curatedProduct as Record<string, unknown> | undefined) : undefined;
      if (s.isCurated && cp) cp.reason = genReason || str(cp.reason) || "";
      if (!s.isCurated) item.reason = genReason || str(item.desc) || "";
    });
  }
  for (const def of TIER2_STEP_DEFS) {
    const items = ((prog.steps || {})[def.key] || {}).products as Array<Record<string, unknown>>;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item && typeof item === "object" && !item.reason) item.reason = str(item.desc);
    }
  }
  prog.stage = "ready";
  return true;
}

// 推荐理由生成（worker 本地副本，避免跨部署包依赖）
async function generateProductReasonsWorker(
  targets: Array<{ name: string; brand: string; price: string }>,
  userFeatures: Record<string, unknown>,
  env: WorkerEnv
): Promise<Record<string, string>> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey || targets.length === 0) return {};
  const itemsPayload = targets.map((t, i) => ({
    index: i,
    name: t.name,
    brand: t.brand || "",
    price: t.price ? "¥" + t.price : "",
  }));
  const prompt =
    "你是资深美妆顾问，请为下列每件商品写一句【针对该用户】的个性化推荐理由。\n" +
    "要求：\n" +
    "- 每句 12-28 个中文字\n" +
    "- 必须结合【用户特征】（肤质/脸型/风格等）与该商品本身的特点（色号/功效/质地/品牌）\n" +
    "- 口语、可信、不夸大，不编造用户没有的特征，不提价格\n" +
    "- 直接写一句话，不要带“推荐理由：”前缀\n\n" +
    "【用户特征】\n" + JSON.stringify(userFeatures) + "\n\n" +
    "【商品列表】\n" + JSON.stringify(itemsPayload) + "\n\n" +
    '只输出严格 JSON，格式为 {"<index>":"一句理由"}，index 为商品在列表中的下标。不要输出 markdown。';
  const parsed = await deepseekJsonCall(env, prompt, 900, 15000, "[tier2/worker:reasons]");
  if (!parsed) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function assembleFinalReport(prog: Tier2Progress): Record<string, unknown> {
  const fa = prog.faceAnalysis || defaultFaceAnalysis();
  const productRecs: Record<string, unknown> = {};
  for (const def of TIER2_STEP_DEFS) {
    productRecs[def.key] = (((prog.steps || {})[def.key] || {}).products as unknown[]) || [];
  }
  return {
    coreConclusion: prog.summary?.coreConclusion || str(fa.highlight) || "你的专属妆容风格方案已生成",
    style: prog.summary?.style || str(fa.personaTags) || "温柔知性风",
    steps: TIER2_STEP_DEFS.map((def) => ({
      step: def.step,
      label: def.label,
      key: def.key,
      emoji: def.emoji,
      ...(((prog.steps || {})[def.key]) || stepFallback(def)),
    })),
    overallTips: prog.summary?.overallTips || "",
    productRecs,
  };
}

// ---------- 推进与兜底 ----------

async function casWriteContent(env: WorkerEnv, id: string, oldContent: string, newContent: string): Promise<boolean> {
  const nowSec = Math.floor(Date.now() / 1000);
  const r = await env.DB.prepare(
    "UPDATE reports_tier2 SET content = ?, updated_at = ? WHERE id = ? AND content = ?"
  ).bind(newContent, nowSec, id, oldContent).run();
  return (r.meta?.changes ?? 0) > 0;
}

async function setTier2Status(env: WorkerEnv, id: string, status: string): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  await env.DB.prepare("UPDATE reports_tier2 SET generation_status = ?, updated_at = ? WHERE id = ?")
    .bind(status, nowSec, id)
    .run();
}

/** 推进一个卡住报告的下一个阶段（单阶段 ≤25s，安全落在 cron 触发器的 ~30s 执行预算内） */
export async function advanceTier2WorkerStage(env: WorkerEnv, tier2Id: string): Promise<{ generationStatus: string; advanced: boolean }> {
  const row = await env.DB.prepare(
    "SELECT id, generation_status, content, face_photo_key, updated_at FROM reports_tier2 WHERE id = ? LIMIT 1"
  ).bind(tier2Id).first<any>();
  if (!row || row.generation_status !== "processing") {
    return { generationStatus: row?.generation_status ?? "not_found", advanced: false };
  }
  const prog = readTier2Progress(row);
  if (!prog) return { generationStatus: "processing", advanced: false };

  // 15 分钟总超时
  if (Date.now() - prog.ts > 15 * 60 * 1000) {
    await setTier2Status(env, tier2Id, "failed");
    console.log(`[tier2/worker] ${tier2Id} timed out -> failed`);
    return { generationStatus: "failed", advanced: true };
  }

  let changed = false;
  switch (prog.stage) {
    case "vision":
      changed = await runVisionStage(env, prog);
      break;
    case "analysis":
      changed = await runAnalysisStage(env, prog);
      break;
    case "summary":
      changed = await runSummaryStage(env, prog);
      break;
    case "enrich":
      changed = await runEnrichStage(env, prog);
      break;
    case "reasons":
      changed = await runReasonsStage(env, prog);
      break;
    default: {
      const m = /^step(\d+)$/.exec(prog.stage);
      if (m) {
        const idx = parseInt(m[1], 10) - 1;
        if (idx >= 0 && idx < TIER2_STEP_DEFS.length) changed = await runStepStage(env, prog, idx);
      }
    }
  }
  if (!changed) return { generationStatus: "processing", advanced: false };

  const oldContent = row.content ?? "";
  if (prog.stage === "ready") {
    const final = assembleFinalReport(prog);
    if (!(await casWriteContent(env, tier2Id, oldContent, JSON.stringify(final)))) {
      return { generationStatus: "processing", advanced: false };
    }
    await setTier2Status(env, tier2Id, "ready");
    console.log(`[tier2/worker] ${tier2Id} ready`);
    return { generationStatus: "ready", advanced: true };
  }
  if (!(await casWriteContent(env, tier2Id, oldContent, JSON.stringify({ _gen: prog })))) {
    return { generationStatus: "processing", advanced: false };
  }
  return { generationStatus: "processing", advanced: true };
}

/** cron 兜底入口：每分钟挑一个卡住的报告推进一个阶段；并清理无进度标记的旧僵尸行 */
export async function runTier2StuckSweep(env: WorkerEnv): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);

  // 1) 旧数据（processing 但 content 无 _gen 进度）且超过 5 分钟：标记 failed（与 /tier2/status 的孤儿规则一致）
  const stale = await env.DB.prepare(
    `SELECT id FROM reports_tier2
     WHERE generation_status = 'processing'
       AND (content IS NULL OR content NOT LIKE '%"_gen"%')
       AND (updated_at IS NULL OR updated_at < ?)
     LIMIT 5`
  ).bind(nowSec - 300).all();
  for (const r of stale.results || []) {
    await setTier2Status(env, r.id, "failed");
    console.log(`[tier2/worker] stale processing -> failed: ${r.id}`);
  }

  // 2) 有 _gen 进度、45 秒没有推进过的报告：推进一个阶段（每轮只处理 1 条，保证单阶段耗时落在触发器预算内）
  const stuck = await env.DB.prepare(
    `SELECT id FROM reports_tier2
     WHERE generation_status = 'processing'
       AND content LIKE '%"_gen"%'
       AND (updated_at IS NULL OR updated_at < ?)
     ORDER BY updated_at ASC
     LIMIT 1`
  ).bind(nowSec - 45).first<any>();
  if (stuck) {
    const adv = await advanceTier2WorkerStage(env, stuck.id);
    console.log(`[tier2/worker] advanced ${stuck.id}: ${adv.generationStatus} (advanced=${adv.advanced})`);
  }
}
