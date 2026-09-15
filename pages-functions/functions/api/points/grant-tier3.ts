// POST /api/points/grant-tier3
// 直连中枢用户态接口 /api/points/grant-tier3（当前登录用户自己的 JWT，中枢按 user_id 发放，按 related_id 幂等去重）。
// 请求体 {amount, related_id}：amount 服务端写死（专属报告生成赠送固定 1 积分，防改价）；
// related_id 取前端透传的 tier3 报告ID（body.reportId，即生成时返回的报告 id），缺省用 'tier3_grant_' + 时间戳兜底。
const AUTH_CENTER_BASE = 'https://auth.meijian.top';
const TIER3_GRANT_AMOUNT = 1;

export const onRequestPost = async (context) => {
  const { request } = context;
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  let relatedId = 'tier3_grant_' + Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    if (body && body.reportId) relatedId = String(body.reportId).slice(0, 128);
  } catch {}
  try {
    const res = await fetch(AUTH_CENTER_BASE + '/api/points/grant-tier3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ amount: TIER3_GRANT_AMOUNT, related_id: relatedId }),
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
