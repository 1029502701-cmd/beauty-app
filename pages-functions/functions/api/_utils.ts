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

export interface JwtPayload {
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

  const session: { userId: string; expiresAt: number } = JSON.parse(sessionStr);
  const now = Math.floor(Date.now() / 1000);
  if (session.expiresAt < now) return null;

  // 滑动过期：每次有效请求刷新 TTL
  await env.SESSION_KV.put(sessionKey, sessionStr, {
    expirationTtl: SESSION_TTL,
  });

  console.log("[requireAuth] session OK userId=" + session.userId);
  return { userId: session.userId };
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

// Enrich product recommendations with real Taobao data (image, price, link) + curated second product
async function enrichProductRecs(
  report: Record<string, unknown>,
  env: Ctx["env"]
): Promise<void> {
  const productRecs = (report.productRecs as Record<string, unknown[]>) ?? {};
  const dims = Object.keys(productRecs);
  for (const dim of dims) {
    const items = productRecs[dim] as Array<{ name: string; desc: string }>;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const name = (item as Record<string, unknown>).name as string;
      if (!name || typeof name !== "string") continue;
      try {
        const product = await findProductByKeyword(name, env);
        if (product) {
          (item as Record<string, unknown>).imageUrl = product.imageUrl;
          (item as Record<string, unknown>).price = product.price;
          (item as Record<string, unknown>).itemUrl = product.itemUrl;
          (item as Record<string, unknown>).shopTitle = product.shopTitle;
          (item as Record<string, unknown>).brandName = product.brandName;
          console.log("[tier2/enrich] Found: " + name + " -> " + product.title.slice(0, 40));
        } else {
          console.log("[tier2/enrich] No match for: " + name);
        }
        // Check for curated second product
        const curated = await findCuratedProduct(name, env);
        if (curated) {
          (item as Record<string, unknown>).curatedProduct = {
            name: curated.name,
            price: curated.price,
            imageUrl: curated.imageUrl,
            itemUrl: curated.itemUrl,
            shopTitle: curated.shopTitle,
          };
          console.log("[tier2/enrich] Curated 2nd product: " + curated.name);
        }
      } catch (e) {
        console.warn("[tier2/enrich] Error enriching " + name + ":", e);
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
        signal: AbortSignal.timeout(90000),
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
      if (report) { await enrichProductRecs(report, env); }
      return report;
    } catch (e) {
      console.error(loggerPrefix + " DeepSeek exception:", e);
      return null;
    }
  }
  return doCall(0);
}




