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
  };
}

export interface AuthUser {
  userId: string;
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

/**
 * 中间件：验证 session，返回 AuthUser 或 null
 */
export async function requireAuth(
  req: Request,
  env: Ctx["env"]
): Promise<AuthUser | null> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
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
