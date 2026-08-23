import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { requireAdminAuth } from '../../../../_utils';
import type { Ctx } from '../../../../_utils';

export const POST: FrameworkCallbackOptions['POST'] = async (context) => {
  const { request, env, params } = context;
  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: '无权限' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const id = (params as any).id as string;
  if (!id) {
    return new Response(JSON.stringify({ error: '缺少达人ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const existing = await env.DB.prepare(
    'SELECT id, status FROM influencers WHERE id = ? LIMIT 1'
  ).bind(id).first<any>();
  if (!existing) {
    return new Response(JSON.stringify({ error: '达人不存在' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  let rejectReason = null;
  try {
    const body = await request.json();
    rejectReason = body?.reason ?? null;
  } catch {}
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE influencers SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?`
  ).bind(rejectReason, now, id).run();
  return new Response(JSON.stringify({ success: true, id, status: 'rejected' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
export const onRequestPost = async (...args) => {
  return (POST as any)(...args);
};