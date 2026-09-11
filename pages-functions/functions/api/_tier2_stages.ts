/**
 * 进阶报告（tier2）分阶段生成引擎。
 *
 * 背景：平台对单次请求的总执行时长限制约 30s（探针实测：后台任务 25s 存活、40s 被杀，
 * waitUntil({timeout:120}) 在免费档不生效），一次性完整生成（面部分析 + 六步妆容 + 商品补全）
 * 永远无法在请求内完成，导致报告卡在 processing。
 * 方案：把生成拆成小阶段（每阶段 ≤25s），进度持久化在 reports_tier2.content 的 "_gen" 字段：
 *   - GET /tier2/status?tier2Id=... 的每次轮询推进一个阶段（用户在看页面时约 2-4 分钟完成）
 *   - scheduled-worker 每分钟兜底推进（用户离开页面后最终也能完成）
 *   - D1 CAS 回写（UPDATE ... WHERE content = 旧值）防止并发双推进
 * 阶段序列：vision → analysis → step1..step6 → summary → enrich → reasons(→ready)
 */
import type { Ctx } from "./_utils";
import { parseDeepseekJson, generateProductReasons, beijingDate } from "./_utils";
import { findProductByKeyword, findCuratedProduct } from "./_taobao";

export const TIER2_STEP_DEFS = [
  { step: "01", label: "底妆", key: "skinType", emoji: "🧴", basedOn: "skinType（肤质状态）" },
  { step: "02", label: "眉形", key: "eyebrowShape", emoji: "✏️", basedOn: "eyebrowShape（眉毛形状）" },
  { step: "03", label: "眼妆", key: "eyeShape", emoji: "👁", basedOn: "eyeShape（眼型）与 threeFiveRatio（三庭比例）" },
  { step: "04", label: "腮红", key: "symmetry", emoji: "🌸", basedOn: "symmetry（面部对称度）" },
  { step: "05", label: "修容", key: "faceShape", emoji: "🪞", basedOn: "faceShape（脸型）" },
  { step: "06", label: "唇妆", key: "lip", emoji: "💄", basedOn: "personaTags（风格标签）与 highlight（亮点）" },
];

export interface Tier2Progress {
  ts: number;            // 生成开始时间（ms），15 分钟总超时
  stage: string;        // vision | analysis | step1..step6 | summary | enrich | reasons | ready
  standalone: boolean;   // true=独立报告（照片上传）；false=关联初识报告
  facePhotoKey?: string | null;
  textDesc?: string;
  faceAnalysis?: Record<string, unknown>;
  steps?: Record<string, Record<string, unknown>>;
  summary?: { coreConclusion: string; style: string; overallTips: string };
  enriched?: boolean;
}

export function readTier2Progress(row: { content?: string | null } | null | undefined): Tier2Progress | null {
  if (!row?.content) return null;
  try {
    const parsed = JSON.parse(row.content);
    return parsed?._gen && typeof parsed._gen === "object" ? parsed._gen as Tier2Progress : null;
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

// 关联初识报告：用 tier1 报告数据构造面部特征（缺失字段用默认值兜底）
export function mergeTier1FaceAnalysis(tier1Report: Record<string, unknown>): Record<string, unknown> {
  const merged = defaultFaceAnalysis();
  for (const k of ["faceShape", "skinType", "eyebrowShape", "eyeShape", "threeFiveRatio", "symmetry", "personaTags", "highlight", "suggestions"]) {
    const v = tier1Report?.[k];
    if (v !== undefined && v !== null && v !== "") merged[k] = v;
  }
  return merged;
}

// 写入初始进度 + processing（重新生成时重置）
export async function initTier2Progress(
  env: Ctx["env"],
  tier2Id: string,
  opts: { standalone: boolean; facePhotoKey?: string | null; faceAnalysis?: Record<string, unknown> }
): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  const prog: Tier2Progress = {
    ts: Date.now(),
    stage: opts.standalone ? "vision" : "step1",
    standalone: opts.standalone,
    facePhotoKey: opts.facePhotoKey ?? null,
  };
  if (!opts.standalone) prog.faceAnalysis = opts.faceAnalysis || defaultFaceAnalysis();
  const payload = JSON.stringify({ _gen: prog });
  try {
    await env.DB.prepare(
      `UPDATE reports_tier2 SET generation_status = 'processing', content = ?, face_photo_key = COALESCE(?, face_photo_key), updated_at = ? WHERE id = ?`
    ).bind(payload, opts.facePhotoKey ?? null, nowSec, tier2Id).run();
  } catch (e) {
    // face_photo_key 列在 0022 迁移中新增；未迁移环境回退
    console.warn("[tier2/stages] face_photo_key update failed, retrying without it:", e);
    await env.DB.prepare(
      `UPDATE reports_tier2 SET generation_status = 'processing', content = ?, updated_at = ? WHERE id = ?`
    ).bind(payload, nowSec, tier2Id).run();
  }
}

// ---------- 内部工具 ----------

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

async function qwenVisionCall(
  env: Ctx["env"],
  prompt: string,
  imageB64DataUrl: string,
  maxTokens: number,
  timeoutMs: number
): Promise<string | null> {
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

async function deepseekJsonCall(
  env: Ctx["env"],
  prompt: string,
  maxTokens: number,
  timeoutMs: number,
  label: string
): Promise<Record<string, unknown> | null> {
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
    return parseDeepseekJson(raw) || null;
  } catch (e) {
    console.error(label, "DeepSeek exception:", e);
    return null;
  }
}

// ---------- 提示词 ----------

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

function stepFallback(def: (typeof TIER2_STEP_DEFS)[number], faceAnalysis: Record<string, unknown>): Record<string, unknown> {
  return {
    analysis: `结合你的${def.basedOn}特征，这一步有稳妥的通用做法。`,
    why: "通用安全方案，适合多数肤质与场合。",
    steps: "清洁打底 → 少量多次上妆 → 局部修正 → 定妆收尾",
    tips: "选择适合自己肤色的色号; 先做敏感测试再全脸使用",
    products: [],
    _fallback: true,
  };
}

// ---------- 阶段执行器（每个只推进一个阶段，单阶段耗时 ≤25s） ----------

async function runVisionStage(env: Ctx["env"], prog: Tier2Progress): Promise<boolean> {
  prog.textDesc = "";
  if (prog.facePhotoKey) {
    try {
      const obj = await withTimeout(env.R2_TEMP.get(prog.facePhotoKey), 5000);
      if (obj) {
        const buf = await withTimeout(obj.arrayBuffer(), 5000);
        if (buf) {
          const desc = await qwenVisionCall(env, VISION_PROMPT, `data:image/jpeg;base64,${b64FromBytes(buf)}`, 500, 15000);
          prog.textDesc = desc || "";
        }
      }
    } catch {
      // 照片读取失败：用空描述继续，analysis 阶段有默认值兜底
    }
  }
  prog.stage = "analysis";
  return true;
}

async function runAnalysisStage(env: Ctx["env"], prog: Tier2Progress): Promise<boolean> {
  const base = defaultFaceAnalysis();
  const parsed = await deepseekJsonCall(env, buildAnalysisPrompt(prog.textDesc || ""), 500, 15000, "[tier2/stages:analysis]");
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

async function runStepStage(env: Ctx["env"], prog: Tier2Progress, idx: number): Promise<boolean> {
  const def = TIER2_STEP_DEFS[idx];
  prog.steps = prog.steps || {};
  let data: Record<string, unknown> | null = null;
  if (env.DEEPSEEK_API_KEY) {
    data = await deepseekJsonCall(env, buildStepPrompt(def, prog.faceAnalysis || defaultFaceAnalysis()), 700, 25000, `[tier2/stages:step${def.step}]`);
  }
  prog.steps[def.key] = data && Array.isArray(data.products) ? data : stepFallback(def, prog.faceAnalysis || defaultFaceAnalysis());
  prog.stage = idx === TIER2_STEP_DEFS.length - 1 ? "summary" : `step${idx + 2}`;
  return true;
}

async function runSummaryStage(env: Ctx["env"], prog: Tier2Progress): Promise<boolean> {
  const fa = prog.faceAnalysis || defaultFaceAnalysis();
  let s: Record<string, unknown> | null = null;
  if (env.DEEPSEEK_API_KEY) {
    s = await deepseekJsonCall(env, buildSummaryPrompt(fa), 400, 15000, "[tier2/stages:summary]");
  }
  prog.summary = {
    coreConclusion: str(s?.coreConclusion) || str(fa.highlight) || "你的专属妆容风格方案已生成",
    style: str(s?.style) || str(fa.personaTags) || "温柔知性风",
    overallTips: str(s?.overallTips) || (Array.isArray(fa.suggestions) ? str(fa.suggestions[0]) : ""),
  };
  prog.stage = "enrich";
  return true;
}

// 商品图检索（限时 18s，超时保留主报告，仅缺图）
async function runEnrichStage(env: Ctx["env"], prog: Tier2Progress): Promise<boolean> {
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
            reason: (curated as unknown as { reason?: string }).reason || undefined,
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

// 推荐理由（限时 15s，失败用 desc 兜底）+ 组装最终报告 → ready
async function runReasonsStage(env: Ctx["env"], prog: Tier2Progress): Promise<boolean> {
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
  if (targets.length > 0 && env.DEEPSEEK_API_KEY) {
    const reasons = (await withTimeout(
      generateProductReasons(targets, (prog.faceAnalysis || {}) as Record<string, unknown>, env),
      15000
    )) || {};
    slots.forEach((s, i) => {
      const item = ((prog.steps || {})[s.dim] || {}).products?.[s.idx] as Record<string, unknown> | undefined;
      if (!item) return;
      const genReason = str(reasons[i]).trim();
      const cp = s.isCurated ? (item.curatedProduct as Record<string, unknown> | undefined) : undefined;
      if (s.isCurated && cp) cp.reason = genReason || str(cp.reason) || "";
      if (!s.isCurated) item.reason = genReason || str(item.desc) || "";
    });
  }
  // 主商品理由兜底：无推荐理由时用 desc
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
      ...(((prog.steps || {})[def.key]) || stepFallback(def, fa)),
    })),
    overallTips: prog.summary?.overallTips || "",
    productRecs,
  };
}

// ---------- CAS 回写与状态 ----------

async function casWriteContent(env: Ctx["env"], id: string, oldContent: string, newContent: string): Promise<boolean> {
  const nowSec = Math.floor(Date.now() / 1000);
  const r = await env.DB.prepare(
    `UPDATE reports_tier2 SET content = ?, updated_at = ? WHERE id = ? AND content = ?`
  ).bind(newContent, nowSec, id, oldContent).run();
  return (r.meta?.changes ?? 0) > 0;
}

async function setTier2Status(env: Ctx["env"], id: string, status: string): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE reports_tier2 SET generation_status = ?, updated_at = ? WHERE id = ?`
  ).bind(status, nowSec, id).run();
}

// 推进一个阶段（由 /tier2/status 轮询或 scheduled-worker 调用；单阶段 ≤25s，可安全跑在 30s 请求预算内）
// 进阶报告「成功完成」才计入当日次数：在 ready 时递增 tier2_daily_usage；失败/进行中不占名额
async function recordTier2DailyUsage(env: Ctx["env"], tier2Id: string): Promise<void> {
  try {
    const row = await env.DB.prepare(`SELECT user_id FROM reports_tier2 WHERE id = ? LIMIT 1`).bind(tier2Id).first<any>();
    if (!row) return;
    const today = beijingDate();
    const used = await env.DB.prepare(
      `SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
    ).bind(row.user_id, today).first<any>();
    if (!used) {
      await env.DB.prepare(`INSERT INTO tier2_daily_usage (user_id, usage_date, used_count) VALUES (?, ?, 1)`).bind(row.user_id, today).run();
    } else {
      await env.DB.prepare(`UPDATE tier2_daily_usage SET used_count = used_count + 1 WHERE user_id = ? AND usage_date = ?`).bind(row.user_id, today).run();
    }
  } catch (e) {
    console.warn("[tier2/stages] recordTier2DailyUsage failed:", e);
  }
}

export async function advanceTier2Stage(
  env: Ctx["env"],
  tier2Id: string
): Promise<{ generationStatus: string; advanced: boolean }> {
  const row = await env.DB.prepare(
    `SELECT id, generation_status, content, face_photo_key, updated_at FROM reports_tier2 WHERE id = ? LIMIT 1`
  ).bind(tier2Id).first<any>();
  if (!row || row.generation_status !== "processing") {
    return { generationStatus: row?.generation_status ?? "not_found", advanced: false };
  }
  const prog = readTier2Progress(row);
  if (!prog) return { generationStatus: "processing", advanced: false };

  // 15 分钟总超时：防止无限重试
  if (Date.now() - prog.ts > 15 * 60 * 1000) {
    await setTier2Status(env, tier2Id, "failed");
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
    await recordTier2DailyUsage(env, tier2Id);
    console.log(`[tier2/stages] ${tier2Id} ready`);
    return { generationStatus: "ready", advanced: true };
  }

  if (!(await casWriteContent(env, tier2Id, oldContent, JSON.stringify({ _gen: prog })))) {
    // 并发推进（另一个轮询先写了）：跳过，等下一次轮询
    return { generationStatus: "processing", advanced: false };
  }
  return { generationStatus: "processing", advanced: true };
}
