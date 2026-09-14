// POST /api/points/grant-tier3
// 直连中枢用户态接口 /api/points/grant-tier3（当前登录用户自己的 JWT，中枢按 user_id 发放，一人一次去重）。
const AUTH_CENTER_BASE = 'https://auth.meijian.top';

export const onRequestPost = async (context) => {
  const { request } = context;
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const res = await fetch(AUTH_CENTER_BASE + '/api/points/grant-tier3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: '{}',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: data.error || '赠送积分失败',
          granted: false,
          balance: typeof data.balance === 'number' ? data.balance : null,
        }),
        { status: res.status === 401 ? 401 : 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({
        granted: !!data.granted,
        balance: typeof data.balance === 'number' ? data.balance : 0,
        reason: data.reason || 'tier3_report',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[points/grant-tier3] direct fetch error:', err);
    return new Response(JSON.stringify({ error: '网络错误，请稍后重试' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
};
