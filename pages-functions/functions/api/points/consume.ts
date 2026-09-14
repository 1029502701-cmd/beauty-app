// POST /api/points/consume
// 直连中枢用户态接口 /api/points/consume（当前登录用户自己的 JWT，中枢按 JWT 里的 user_id 扣 user_points）。
// 价格/去重约定：
// - amount 本端服务端写死（解锁专属报告固定 6 积分），不透传前端值（防改价）；
// - 解锁场景 reason = 'unlock_report_' + reportId，once=true → 中枢 points_dedup 去重，一人一次；
// - 其他业务事件 reason 由前端指定，once=false。
const AUTH_CENTER_BASE = 'https://auth.meijian.top';
const UNLOCK_REPORT_AMOUNT = 6;

export const onRequestPost = async (context) => {
  const { request } = context;
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token) {
    return new Response(JSON.stringify({ error: '未登录' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let reason; let amount; let once;
  try {
    const body = (await request.json());
    if (body.action === 'unlock_report' && body.reportId) {
      reason = 'unlock_report_' + String(body.reportId);
      amount = UNLOCK_REPORT_AMOUNT;
      once = true;
    } else if (body.action) {
      reason = String(body.action);
      amount = UNLOCK_REPORT_AMOUNT;
      once = false;
    } else {
      return new Response(JSON.stringify({ error: '缺少 action' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: '请求体不是合法 JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(AUTH_CENTER_BASE + '/api/points/consume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ reason, amount, once }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 402 积分不足 / 401 未授权 等：原样透传状态与原因，前端据此保持未解锁
      return new Response(
        JSON.stringify({
          consumed: false,
          balance: typeof data.balance === 'number' ? data.balance : null,
          reason: data.reason || data.error || '扣减失败',
        }),
        { status: res.status === 401 ? 401 : res.status === 402 ? 402 : 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({
        consumed: !!data.consumed,
        balance: typeof data.balance === 'number' ? data.balance : null,
        reason: data.reason || reason,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[points/consume] direct fetch error:', err);
    return new Response(JSON.stringify({ error: '网络错误，请稍后重试' }), {
      status: 502, headers: { 'Content-Type': 'application/json' },
    });
  }
};
