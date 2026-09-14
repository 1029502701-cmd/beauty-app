// GET /api/points/balance
// 直连中枢用户态积分接口（当前登录用户自己的 JWT），中枢从 JWT 解出 user_id 查 user_points，无手机号中转。
const AUTH_CENTER_BASE = 'https://auth.meijian.top';

export const GET = async (context) => {
  const { request } = context;
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const res = await fetch(AUTH_CENTER_BASE + '/api/points/balance', {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 401/403 透传，前端会清理本地 token 并引导重新登录
      return new Response(JSON.stringify({ error: data.error || '获取积分失败' }), {
        status: res.status === 401 || res.status === 403 ? res.status : 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ balance: typeof data.balance === 'number' ? data.balance : 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[points/balance] direct fetch error:', err);
    return new Response(JSON.stringify({ error: '网络错误，请稍后重试' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const onRequestGet = async (...args: unknown[]) => { return (GET as any)(...args); };
