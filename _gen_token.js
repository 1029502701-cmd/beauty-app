const crypto = require('crypto');
const secret = 'chat-ai-auth-unified-secret-key-2026-do-not-leak';
const enc = new TextEncoder();
function b64u(buf) { 
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, ''); 
}
async function gen() {
  const now = Math.floor(Date.now()/1000);
  const h = b64u(enc.encode(JSON.stringify({alg:'HS256',typ:'JWT'})));
  const p1 = b64u(enc.encode(JSON.stringify({user_id:'valid-user-001',iat:now,exp:now+3600})));
  const k1 = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const s1 = await crypto.subtle.sign('HMAC', k1, enc.encode(h+'.'+p1));
  console.log('VALID=' + h+'.'+p1+'.'+b64u(new Uint8Array(s1)));
  const p2 = b64u(enc.encode(JSON.stringify({user_id:'expired-user',iat:now-7200,exp:now-3600})));
  const k2 = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
  const s2 = await crypto.subtle.sign('HMAC', k2, enc.encode(h+'.'+p2));
  console.log('EXPIRED=' + h+'.'+p2+'.'+b64u(new Uint8Array(s2)));
  console.log('FORGED=' + h+'.'+p1+'.INVALID_SIG');
}
gen();
