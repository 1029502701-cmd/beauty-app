import type { FrameworkCallbackOptions } from "@cloudflare/workers-types";

function b64urlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
}

export const GET: FrameworkCallbackOptions["GET"] = async (context) => {
  const { env } = context;
  if (!env.DEBUG_MODE) {
    return new Response(JSON.stringify({error:"not available in production"}),{status:404});
  }
  const secret = env.AUTH_JWT_SECRET;
  const enc = new TextEncoder();

  let sigResult = 'N/A';
  let verifyResult = 'N/A';
  let tokenPayload = 'N/A';

  if (secret) {
    try {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const now = Math.floor(Date.now() / 1000);
      const payload = btoa(JSON.stringify({ user_id: 'debug-test', iat: now, exp: now + 3600 }))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const message = header + '.' + payload;

      // Sign with a sign+verify key
      const skey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
      const sig = await crypto.subtle.sign('HMAC', skey, enc.encode(message));
      const sig64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const token = message + '.' + sig64;

      // Verify with a SEPARATE verify-only key
      const vkey = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const parts = token.split('.');
      const valid = await crypto.subtle.verify('HMAC', vkey, b64urlDecode(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
      sigResult = 'signed OK';
      verifyResult = String(valid);
      tokenPayload = payload;
    } catch (e: any) {
      sigResult = 'ERROR: ' + e.message;
    }
  } else {
    sigResult = 'NO_SECRET';
  }

  return new Response(JSON.stringify({
    hasJwtSecret: !!secret,
        sigResult,
    verifyResult,
    tokenPayload,
  }), { headers: { "Content-Type": "application/json" } });
};
export const onRequestGet = async (...args) => (GET as any)(...args);
