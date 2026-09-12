// Inline Platform type (replaces broken import from functions/worker)

// Session key prefix in KV
export const SESSION_PREFIX = "session:";
// Session TTL: 7 days in seconds
const SESSION_TTL = 7 * 24 * 60 * 60;
// Admin session prefix in KV
const ADMIN_SESSION_PREFIX = "admin_session:";
// Admin session TTL: 30 days in seconds
const ADMIN_SESSION_TTL = 30 * 24 * 60 * 60;

export interface Ctx {
  env: {
    DB: D1Database;
    SESSION_KV: KVNamespace;
    R2_TEMP: R2Bucket;
    R2_PERM: R2Bucket;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
    AUTH_JWT_SECRET?: string;
    AUTH_CENTER_SERVICE_TOKEN?: string;
  };
}

export interface AuthUser {
  userId: string;
  gender?: string | null;
  age_range?: string | null;
}

/**
 * 中间件：验证 admin session，返回 true/false
 */
export async function requireAdminAuth(
  req: Request,
  env: Ctx["env"]
): Promise<boolean> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;

  const sessionKey = `${ADMIN_SESSION_PREFIX}${token}`;
  const sessionStr = await env.SESSION_KV.get(sessionKey);
  if (!sessionStr) return false;

  const session: { expiresAt: number } = JSON.parse(sessionStr);
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt < now) return false;

  // 滑动过期
  await env.SESSION_KV.put(sessionKey, sessionStr, {
    expirationTtl: ADMIN_SESSION_TTL,
  });

  return true;
}

/**
 * 对明文密码做 PBKDF2 hash，返回 base64(hash):salt 字符串
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256
  );
  const hashBuf = new Uint8Array(derivedBits);
  return btoa(String.fromCharCode(...hashBuf)) + ":" + salt;
}

// --- Pure-JS JWT helpers (Web Crypto API, no node:crypto) ---

function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  let base64 = str
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const bytes = new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
  return bytes;
}

async function signHmacSha256(key: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return new Uint8Array(signature);
}

async function verifyHmacSha256(key: string, message: string, signature: Uint8Array): Promise<boolean> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  return crypto.subtle.verify('HMAC', cryptoKey, signature, enc.encode(message));
}

export interface JwtPayload { phone?: string; 
  user_id: string;
  iat: number;
  exp: number;
  gender?: string | null;
  age_range?: string | null;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('[verifyJwt] INVALID_FORMAT: token has ' + parts.length + ' parts instead of 3');
      return null;
    }
    const [header, body, signature] = parts;
    const sigBytes = base64urlDecode(signature);
    const valid = await verifyHmacSha256(secret, header + '.' + body, sigBytes);
    if (!valid) {
      console.error('[verifyJwt] SIGNATURE_MISMATCH: HMAC verification failed (secret may be wrong)');
      return null;
    }
    try {
      const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.error('[verifyJwt] EXPIRED: token expired at ' + payload.exp + ', now=' + now);
        return null;
      }
      console.log('[verifyJwt] OK user_id=' + payload.user_id + ' gender=' + payload.gender);
      return payload;
    } catch (e) {
      console.error('[verifyJwt] PAYLOAD_PARSE_ERROR: ' + e);
      return null;
    }
  } catch (e) {
    console.error('[verifyJwt] EXCEPTION: ' + e);
    return null;
  }
}


// ── 账号中枢（chat-ai-auth）服务令牌直连 ─────────────────────────────────────────
// 积分数据由中枢统一管理：读/扣都走 /api/sync/points*，带服务令牌，不再透传用户 JWT。
// AUTH_CENTER_SERVICE_TOKEN 为中枢签发的服务令牌（Pages secret，勿写进 wrangler.toml）。
export const AUTH_CENTER_URL =
  "https://chat-ai-auth.y512149214.workers.dev";

/**
 * 解析登录用户手机号（供中枢 /api/sync/points* 用）：
 * 1) 中枢 JWT 载荷 phone（若有）
 * 2) 本端 D1 users.phone（按 userId）
 * 3) KV session（按 token）
 */
export async function resolveUserPhone(
  req: Request,
  env: Ctx["env"],
  user: AuthUser
): Promise<string> {
  const authHeader = req.headers.get("Authorization") || "";
  let token = "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.slice("Bearer ".length).trim();
  else token = authHeader.replace("Bearer ", "").trim();

  // 1) 中枢 JWT 的 phone claim
  if (token && env.AUTH_JWT_SECRET) {
    const payload = await verifyJwt(token, env.AUTH_JWT_SECRET);
    if (payload?.phone) return String(payload.phone);
  }

  // 2) 本端 user_phone_map（登录时落库，最权威）
  const mapRow = await env.DB
    .prepare("SELECT phone FROM user_phone_map WHERE user_id = ? LIMIT 1")
    .bind(user.userId)
    .first<{ phone: string | null }>();
  if (mapRow?.phone) return String(mapRow.phone);
  // 2b) 兜底：本端 users 表的 phone 列
  const row = await env.DB
    .prepare("SELECT phone FROM users WHERE id = ? LIMIT 1")
    .bind(user.userId)
    .first<{ phone: string | null }>();
  if (row?.phone) return String(row.phone);

  // 3) KV session
  if (token && env.SESSION_KV) {
    const sessionStr = await env.SESSION_KV.get(SESSION_PREFIX + token);
    if (sessionStr) {
      const session: { userId?: string } = JSON.parse(sessionStr);
      const id = session.userId || user.userId;
      const srow = await env.DB
        .prepare("SELECT phone FROM users WHERE id = ? LIMIT 1")
        .bind(id)
        .first<{ phone: string | null }>();
      if (srow?.phone) return String(srow.phone);
    }
  }
  return "";
}

/**
 * 调中枢积分接口（带服务令牌）。中枢返回 { balance } 或 { consumed, balance, ... }；
 * 非 2xx 时原样返回 { ok:false, status, error } 供调用方决定。
 */
export async function authCenterPoints(
  env: Ctx["env"],
  path: string,
  opts: { phone: string; method?: string; body?: unknown }
): Promise<Record<string, unknown> & { ok: boolean }> {
  const serviceToken = env.AUTH_CENTER_SERVICE_TOKEN;
  if (!serviceToken) {
    return { ok: false, status: 502, error: "中枢服务令牌未配置" };
  }
  const url =
    AUTH_CENTER_URL +
    path +
    (opts.phone ? "?phone=" + encodeURIComponent(opts.phone) : "");
  try {
    const res = await fetch(url, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + serviceToken,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data: Record<string, unknown> = await res.json().catch(() => ({}));
    if (!res.ok) return { ...data, ok: false, status: res.status };
    return { ...data, ok: true, status: res.status };
  } catch (err) {
    console.error("[authCenterPoints] error:", err);
    return { ok: false, status: 502, error: "网络错误，请稍后重试" };
  }
}

/**
 * 中间件：优先验证 JWT，失败则回退到 session 验证，返回 AuthUser 或 null
 */
export async function requireAuth(
  req: Request,
  env: Ctx["env"]
): Promise<AuthUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  console.log("[requireAuth] authHeader present=" + !!authHeader + " startsWithBearer=" + authHeader.startsWith("Bearer ") + " hasSecret=" + !!env.AUTH_JWT_SECRET);

  // 1. 优先尝试 JWT 验证（chat-ai-auth 签发）
  if (authHeader.startsWith("Bearer ") && env.AUTH_JWT_SECRET) {
    const jwtToken = authHeader.slice("Bearer ".length);
    const payload = await verifyJwt(jwtToken, env.AUTH_JWT_SECRET);
    if (payload) {
      const userId = payload.user_id;
      try {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO users (id, phone, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).bind(userId, 'jwt-' + userId.slice(0, 8), Math.floor(Date.now()/1000), Math.floor(Date.now()/1000)).run();
      } catch(e) {
        console.warn('[requireAuth] auto-create user failed:', e);
      }
      return { userId, gender: payload.gender, age_range: payload.age_range };
    }
  }

  // 2. 回退到 session 验证（原有逻辑）
  console.log("[requireAuth] JWT failed, falling back to session auth");
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  const sessionKey = `${SESSION_PREFIX}${token}`;
  const sessionStr = await env.SESSION_KV.get(sessionKey);
  if (!sessionStr) return null;

  const session: { userId: string; gender?: string | null; age_range?: string | null; expiresAt: number } = JSON.parse(sessionStr);
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt < now) return null;

  // 滑动过期：每次有效请求刷新 TTL
  await env.SESSION_KV.put(sessionKey, sessionStr, {
    expirationTtl: SESSION_TTL,
  });

  console.log("[requireAuth] session OK userId=" + session.userId);
  return { userId: session.userId, gender: session.gender || null, age_range: session.age_range || null };
}

/**
 * 北京时间 YYYY-MM-DD 字符串
 */
export function beijingDate(): string {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return shanghai.toISOString().slice(0, 10);
}

/**
 * 北京时间当天 24:00 的时间戳（毫秒）
 */
export function beijingEndOfDayMs(): number {
  const now = new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  shanghai.setHours(24, 0, 0, 0);
  return shanghai.getTime();
}

/**
 * 生成 UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 从环境变量读取管理员账号密码
 */
export function getAdminCredentials(env: Ctx["env"]): { username: string; password: string } | null {
  const username = env.ADMIN_USERNAME;
  const password = env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

/**
 * 验证管理员用户名密码
 */
export async function verifyAdminCredentials(
  username: string,
  password: string,
  env: Ctx["env"]
): Promise<boolean> {
  const creds = getAdminCredentials(env);
  if (!creds) return false;
  return creds.username === username && creds.password === password;
}
/**
 * 剥离 DeepSeek 返回内容中可能包裹的 Markdown 代码块（```json ... ```），再解析 JSON
 */
export function parseDeepseekJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^```(?:json)?`/m, "").replace(/```\s*$/m, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    console.error("[parseDeepseekJson] Invalid JSON after stripping markdown wrapper:", cleaned.slice(0, 500));
    return null;
  }
}

import { findProductByKeyword, findCuratedProduct } from "./_taobao";

// 用 DeepSeek 为一批商品生成"针对当前用户"的个性化推荐理由（一次批量调用，降低时延）
export async function generateProductReasons(
  targets: Array<{ name: string; brand: string; price: string }>,
  userFeatures: Record<string, unknown>,
  env: Ctx["env"]
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
    "- 必须结合【用户特征】（肤质/脸型/风格等）与该商品本身的特点（色号/功效/质地/品牌等）\n" +
    "- 口语、可信、不夸大，不编造用户没有的特征，不提价格\n" +
    "- 直接给一句话，不要带“推荐理由：”前缀\n\n" +
    "【用户特征】\n" + JSON.stringify(userFeatures) + "\n\n" +
    "【商品列表】\n" + JSON.stringify(itemsPayload) + "\n\n" +
    '只输出严格 JSON，格式为 {"<index>":"一句理由"}，index 为商品在列表中的下标。不要输出 markdown。';
  try {
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 900,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      console.warn("[tier2/reasons] DeepSeek HTTP " + resp.status);
      return {};
    }
    const data: any = await resp.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return {};
    const parsed = parseDeepseekJson(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    console.warn("[tier2/reasons] error:", e);
    return {};
  }
}

// Enrich product recommendations with real Taobao data (image, price, link) + curated second product,
// 并调用 DeepSeek 为每件商品生成"针对该用户"的个性化推荐理由（reason 字段）
async function enrichProductRecs(
  report: Record<string, unknown>,
  env: Ctx["env"],
  tier1Report?: Record<string, unknown>
): Promise<void> {
  const productRecs = (report.productRecs as Record<string, unknown[]>) ?? {};
  const dims = Object.keys(productRecs);
  // 用户特征（用于生成个性化推荐理由）
  const userFeatures: Record<string, unknown> = {};
  if (tier1Report) {
    const keys = ["faceShape", "skinType", "eyebrowShape", "eyeShape", "threeFiveRatio", "symmetry", "personaTags", "highlight"];
    for (const k of keys) {
      const v = tier1Report[k];
      if (v !== undefined && v !== null && v !== "") userFeatures[k] = v;
    }
  }
  // 第一遍：匹配真实商品（Taobao + curated），并收集需要生成理由的商品
  const reasonTargets: Array<{ dim: string; idx: number; isCurated: boolean }> = [];
  for (const dim of dims) {
    const items = productRecs[dim] as Array<Record<string, unknown>>;
    if (!Array.isArray(items)) continue;
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (!item || typeof item !== "object") continue;
      const name = item.name as string;
      if (!name || typeof name !== "string") continue;
      try {
        const product = await findProductByKeyword(name, env);
        if (product) {
          item.imageUrl = product.imageUrl;
          item.price = product.price;
          item.itemUrl = product.itemUrl;
          item.shopTitle = product.shopTitle;
          item.brandName = product.brandName;
          console.log("[tier2/enrich] Found: " + name + " -> " + product.title.slice(0, 40));
        } else {
          console.log("[tier2/enrich] No match for: " + name);
        }
        // Check for curated second product
        const curated = await findCuratedProduct(name, env);
        if (curated) {
          item.curatedProduct = {
            name: curated.name,
            price: curated.price,
            imageUrl: curated.imageUrl,
            itemUrl: curated.itemUrl,
            shopTitle: curated.shopTitle,
            reason: (curated as unknown as { reason?: string }).reason || undefined,
          };
          console.log("[tier2/enrich] Curated 2nd product: " + curated.name);
        }
        reasonTargets.push({ dim, idx, isCurated: false });
        if (item.curatedProduct) reasonTargets.push({ dim, idx, isCurated: true });
      } catch (e) {
        console.warn("[tier2/enrich] Error enriching " + name + ":", e);
      }
    }
  }
  // 第二遍：批量生成个性化推荐理由
  if (reasonTargets.length > 0) {
    const productsForPrompt = reasonTargets.map((t) => {
      const item = (productRecs[t.dim] as Array<Record<string, unknown>>)[t.idx];
      const cp = t.isCurated ? (item?.curatedProduct as Record<string, unknown> | undefined) : undefined;
      if (t.isCurated && !cp) return null;
      if (cp) return { name: String(cp.name || ""), brand: String(cp.shopTitle || ""), price: cp.price ? String(cp.price) : "" };
      return { name: String(item?.name || ""), brand: String(item?.brandName || ""), price: item?.price ? String(item.price) : "" };
    }).filter(Boolean) as Array<{ name: string; brand: string; price: string }>;
    if (productsForPrompt.length > 0) {
      const reasons = await generateProductReasons(productsForPrompt, userFeatures, env);
      reasonTargets.forEach((t, pos) => {
        const item = (productRecs[t.dim] as Array<Record<string, unknown>>)[t.idx];
        if (!item) return;
        const genReason = String(reasons[pos] || "").trim();
        if (t.isCurated) {
          const cp = item.curatedProduct as Record<string, unknown> | undefined;
          if (cp) cp.reason = genReason || String(cp.reason || "");
        } else if (genReason) {
          item.reason = genReason;
        }
      });
      // 主商品理由兜底：AI 未生成时用 desc
      for (const t of reasonTargets.filter((x) => !x.isCurated)) {
        const item = (productRecs[t.dim] as Array<Record<string, unknown>>)[t.idx];
        if (item && !item.reason && item.desc) item.reason = String(item.desc);
      }
    }
  }
}

export async function callDeepSeekTier2(
  tier1Report: Record<string, unknown>,
  env: Ctx["env"],
  loggerPrefix: string = "[tier2/generate]"
): Promise<Record<string, unknown> | null> {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn(loggerPrefix + " DEEPSEEK_API_KEY not configured");
    return null;
  }
  const prompt = `You are a professional beauty consultant. Based on the following face analysis report, provide detailed personalized recommendations for each of the 6 makeup steps.

Face Analysis Report:
${JSON.stringify(tier1Report, null, 2)}

Rules for each step:
- Step 01 (base makeup): based on skinType (skin condition)
- Step 02 (eyebrows): based on eyebrowShape
- Step 03 (eye makeup): combine eyeShape + threeFiveRatio
- Step 04 (blush): based on symmetry
- Step 05 (contour): based on faceShape
- Step 06 (lip): combine personaTags + highlight to infer skin tone & lip shape recommendations

Output strict JSON only (no markdown wrapping):
{
  "coreConclusion": "1-2 sentence overall style conclusion in Chinese",
  "style": "style tag like 温柔知性风",
  "steps": [
    {"step":"01","label":"底妆","key":"skinType","emoji":"🧴","analysis":"<personalized analysis for THIS user>","why":"<why this approach fits>","steps":"<step-by-step instructions separated by arrows>","tips":"<warnings separated by semicolons>","products":[{"name":"product name","desc":"reason","price":"price"}]},
    {"step":"02","label":"眉形","key":"eyebrowShape","emoji":"✏️","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]},
    {"step":"03","label":"眼妆","key":"eyeShape","emoji":"👁","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]},
    {"step":"04","label":"腮红","key":"symmetry","emoji":"🌸","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]},
    {"step":"05","label":"修容","key":"faceShape","emoji":"🪞","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]},
    {"step":"06","label":"唇妆","key":"lip","emoji":"💄","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]}
  ],
  "overallTips": "1-2 sentence summary in Chinese",
  "productRecs": {
    "skinType": [{"name":"product name","desc":"reason"}],
    "eyebrowShape": [{"name":"product name","desc":"reason"}],
    "eyeShape": [{"name":"product name","desc":"reason"}],
    "symmetry": [{"name":"product name","desc":"reason"}],
    "faceShape": [{"name":"product name","desc":"reason"}],
    "lip": [{"name":"product name","desc":"reason"}]
  }
}

Important:
1. Every step must be personalized to THIS specific user - reference their actual features
2. Use '你是X' format in analysis (e.g. '你是圆脸' not '圆脸适合')
3. Separate tips with Chinese semicolons (;)
4. Recommend specific real products suitable for this user`;
  async function doCall(retryCount: number): Promise<Record<string, unknown> | null> {
    try {
      const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], max_tokens: 8000, temperature: 0.3 }),
        // 60s：后台任务整体需留在 waitUntil({ timeout: 120 }) 的平台上限内（主调用 60s + 补全 30s ≈ 90s）
        signal: AbortSignal.timeout(60000),
      });
      if (!resp.ok) {
        const eb = await resp.text().catch(() => "");
        console.error(loggerPrefix + " DeepSeek error " + resp.status + ": " + eb.slice(0, 200));
        return null;
      }
      const data: any = await resp.json();
      const raw = data?.choices?.[0]?.message?.content;
      if (!raw) return null;
      const report = parseDeepseekJson(raw);
      if (report) {
        // 商品图检索（enrich）限时 30s：超时也保留主报告；与主调用 60s 合计约 90s，避免后台任务被平台回收
        await Promise.race([enrichProductRecs(report, env, tier1Report), new Promise((resolve) => setTimeout(resolve, 30000))]);
      }
      return report;
    } catch (e) {
      console.error(loggerPrefix + " DeepSeek exception:", e);
      return null;
    }
  }
  return doCall(0);
}






/**
 * 返回标准 CORS OPTIONS 响应（处理预检请求）
 */
export function makeOptionsHandler(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}


// 异步生成 tier2 报告（后台执行，不阻塞解锁/生成接口的响应）
// 生成完成后更新 reports_tier2 对应记录；失败时标记 failed，避免卡在 pending
export async function generateTier2RecordAsync(
  tier1Report: Record<string, unknown>,
  tier2Id: string,
  env: Ctx["env"],
  loggerPrefix: string = "[tier2/async]"
): Promise<void> {
  const setStatus = async (status: string, content?: string) => {
    const now = Math.floor(Date.now() / 1000);
    if (content) {
      await env.DB.prepare(
        `UPDATE reports_tier2 SET content = ?, generation_status = ?, updated_at = ? WHERE id = ?`
      ).bind(content, status, now, tier2Id).run();
    } else {
      await env.DB.prepare(
        `UPDATE reports_tier2 SET generation_status = ?, updated_at = ? WHERE id = ?`
      ).bind(status, now, tier2Id).run();
    }
  };
  try {
    // 先标记 processing，让前端轮询可见中间状态
    const t0 = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `UPDATE reports_tier2 SET generation_status = 'processing', updated_at = ? WHERE id = ?`
    ).bind(t0, tier2Id).run();
    const tier2Content = await callDeepSeekTier2(tier1Report, env, loggerPrefix);
    if (tier2Content) {
      await setStatus("ready", JSON.stringify(tier2Content));
      console.log(`${loggerPrefix} ready for ${tier2Id}`);
    } else {
      await setStatus("failed");
      console.error(`${loggerPrefix} no content for ${tier2Id}`);
    }
  } catch (e) {
    console.error(`${loggerPrefix} exception for ${tier2Id}:`, e);
    try { await setStatus("failed"); } catch {}
  }
}
