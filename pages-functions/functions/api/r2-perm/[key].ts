import type { FrameworkCallbackOptions } from '@cloudflare/workers-types';

// GET /api/r2-perm/{key}
// 代理读取 R2_PERM（beauty-perm）桶中的文件，供前端 img src 直接访问
export const GET: FrameworkCallbackOptions['GET'] = async (context) => {
  const { env, params } = context;
  const key = params?.key as string;

  if (!key) {
    return new Response(JSON.stringify({ error: '缺少 key 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const obj = await env.R2_PERM.get(key);
    if (!obj) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = obj.httpMetadata?.contentType || 'application/octet-stream';

    let body: Uint8Array;
    if ('arrayBuffer' in obj && typeof obj.arrayBuffer === 'function') {
      body = new Uint8Array(await obj.arrayBuffer());
    } else {
      return new Response(JSON.stringify({ error: 'cannot read body' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('[r2-perm-proxy] Error:', e);
    return new Response(JSON.stringify({ error: 'internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestGet = async (...args) => {
  return (GET as any)(...args);
};