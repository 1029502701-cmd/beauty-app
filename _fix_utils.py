import re

path = r"C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions\functions\api\_utils.ts"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add AUTH_JWT_SECRET to Ctx interface
content = content.replace(
    '    ADMIN_PASSWORD?: string;\n  };',
    '    ADMIN_PASSWORD?: string;\n    AUTH_JWT_SECRET?: string;\n  };'
)

# Check if already has JWT helpers
if "verifyJwt" not in content:
    # 2. Insert JWT helpers + new requireAuth before the old requireAuth
    old_func_start = "/**\n * 中间件：验证 session，返回 AuthUser 或 null\n */"
    old_func_end = "  return { userId: session.userId };\n}"
    
    idx_start = content.find(old_func_start)
    if idx_start == -1:
        print("ERROR: Could not find old requireAuth comment")
        exit(1)
    
    # Find the end of the function (next function start or next major comment)
    idx_end = content.find("\n/**", idx_start + 1)
    if idx_end == -1:
        idx_end = len(content)
    
    old_block = content[idx_start:idx_end]
    
    new_block = '''// --- Pure-JS JWT helpers (Web Crypto API, no node:crypto) ---

function base64urlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\\\\+/g, '-')
    .replace(/\\\\//g, '_')
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
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const valid = await verifyHmacSha256(secret, header + '.' + body, base64urlDecode(signature));
  if (!valid) return null;
  try {
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
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

  // 1. 优先尝试 JWT 验证（chat-ai-auth 签发）
  if (authHeader.startsWith("Bearer ") && env.AUTH_JWT_SECRET) {
    const jwtToken = authHeader.slice("Bearer ".length);
    const payload = await verifyJwt(jwtToken, env.AUTH_JWT_SECRET);
    if (payload) {
      return { userId: payload.user_id };
    }
  }

  // 2. 回退到 session 验证（原有逻辑）
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

  return { userId: session.userId };
}
'''
    
    content = content[:idx_start] + new_block + content[idx_end:]

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS: _utils.ts updated")
