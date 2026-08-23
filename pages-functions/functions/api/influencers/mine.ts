import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { requireAuth } from '../../_utils';
import type { Ctx } from '../../_utils';

export const GET: FrameworkCallbackOptions['GET'] = async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const record = await env.DB.prepare(
    `SELECT id, user_id, nickname, bio, makeup_photo_url, platform, link1, link2,
            status, reject_reason, created_at, updated_at
     FROM influencers
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`
  ).bind(user.userId).first<any>();
  if (!record) {
    return new Response(JSON.stringify({ exists: false }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({
    exists: true,
    id: record.id,
    nickname: record.nickname,
    status: record.status,
    submittedAt: record.created_at,
    rejectReason: record.reject_reason,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
