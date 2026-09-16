// POST /api/invite/redeem —— 纯透传到中枢 /api/invite/redeem（兑换邀请码赠送积分）。
// 登录态（用户 JWT）与兑换逻辑全部在中枢；本端只做带 Authorization 头的透传，不缓存、不转换中枢数据。
// 入参 { inviteCode }：邀请码字符串；中枢校验归属/重复兑换/自邀，并按需发放积分。
const AUTH_CENTER_BASE = 'https://auth.meijian.top';

export const onRequestPost = async (context) => {
  const { request } = context;
  const token = extractJwt(request);
  if (!token) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  let inviteCode;
  try {
    const body = (await request.json());
    inviteCode = body.inviteCode ? String(body.inviteCode).trim() : '';
  } catch {
    return new Response(JSON.stringify({ error: '请求体不是合法 JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!inviteCode) {
    return new Response(JSON.stringify({ error: '缺少 inviteCode' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const res = await fetch(AUTH_CENTER_BASE + '/api/invite/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ inviteCode }),
    });
    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[invite/redeem] direct fetch error:', err);
    return new Response(JSON.stringify({ error: '网络错误，请稍后重试' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
};
