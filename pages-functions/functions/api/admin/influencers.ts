import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';
import { requireAdminAuth } from '../../_utils';
import type { Ctx } from '../../_utils';

// 自动修复历史脏数据中的无效 makeup_photo_url
// 脏数据特征：字面量字符串 /api/r2-perm/${makeupKey}（模板字符串未插值）
// 修复方式：根据 influencers.id 重建正确的 r2-proxy URL
function fixMakeupPhotoUrl(url: string | null, influencerId: string): string | null {
  if (!url) return null;
  // 修复字面量模板字符串脏数据
  if (url.includes('${makeupKey}') || url.includes('${makeup_key}')) {
    const key = `influencer/${influencerId}/makeup.jpg`;
    return `/api/r2-proxy?key=${encodeURIComponent(key)}&bucket=perm`;
  }
  // 兼容旧格式的直接 r2-perm URL
  if (url.startsWith('/api/r2-perm/')) {
    const key = url.slice('/api/r2-perm/'.length);
    return `/api/r2-proxy?key=${encodeURIComponent(key)}&bucket=perm`;
  }
  return url;
}

// GET /api/admin/influencers 查询达人列表（支持 ?status=pending|approved|rejected）
export const GET: FrameworkCallbackOptions['GET'] = async (context) => {
  const { request, env } = context;

  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: '无权限' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');

  let sql = `SELECT i.id, i.user_id, i.nickname, i.bio, i.makeup_photo_url,
                  i.platform, i.link1, i.link2, i.status, i.reject_reason,
                  i.created_at, i.updated_at, i.styles, fp.tags
            FROM influencers i
            LEFT JOIN influencer_face_profile fp ON fp.influencer_id = i.id`;
  const params: any[] = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';

  const results = await env.DB.prepare(sql).bind(...params).all<any>();
  const list = (results.results ?? []).map((item: any) => {
    let personaTags: string[] = [];
    try { personaTags = JSON.parse(item.tags || '{}').personaTags ? [JSON.parse(item.tags || '{}').personaTags] : []; } catch {}
    return {
      ...item,
      makeup_photo_url: fixMakeupPhotoUrl(item.makeup_photo_url, item.id),
      persona_tags: personaTags,
      styles: (() => { try { return JSON.parse(item.styles || "[]"); } catch { return []; } })(),
    };
  });

  return new Response(JSON.stringify({ list }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};
