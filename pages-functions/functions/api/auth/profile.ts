import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { requireAuth } from '../../_utils';

export const GET: FrameworkCallbackOptions['GET'] = async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: '未授权' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const sessionKey = 'session:' + token;
  let gender = auth.gender;
  let age_range = auth.age_range;
  try {
    const sessionStr = await env.SESSION_KV.get(sessionKey);
    if (sessionStr) {
      const s = JSON.parse(sessionStr);
      gender = s.gender || auth.gender;
      age_range = s.age_range || auth.age_range;
    }
  } catch (e) {
    console.error('[profile/GET] session read error:', e);
  }
  return new Response(JSON.stringify({ gender, age_range, completed: !!(gender && age_range) }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: FrameworkCallbackOptions['POST'] = async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: '未授权' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  const body = await request.json();
  const { gender, age_range } = body as { gender?: string; age_range?: string };
  if (!gender || !age_range) {
    return new Response(JSON.stringify({ error: '请提供性别和年龄范围' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? '';
  const sessionKey = 'session:' + token;
  try {
    const sessionStr = await env.SESSION_KV.get(sessionKey);
    if (sessionStr) {
      const s = JSON.parse(sessionStr);
      s.gender = gender;
      s.age_range = age_range;
      const ttl = Math.max(s.expiresAt - Math.floor(Date.now() / 1000), 60);
      await env.SESSION_KV.put(sessionKey, JSON.stringify(s), { expirationTtl: ttl });
    }
  } catch (e) {
    console.error('[profile/POST] session write error:', e);
  }
  return new Response(JSON.stringify({ gender, age_range }), { headers: { 'Content-Type': 'application/json' } });
};

export const onRequestGet = async (...args) => GET(args[0]);
export const onRequestPost = async (...args) => POST(args[0]);