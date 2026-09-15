// POST /api/points/consume
// 直连中枢用户态接口 /api/points/consume（当前登录用户自己的 JWT，中枢按 JWT 里的 user_id 扣 user_points）。
// 价格/去重约定：
// - amount 本端服务端写死（解锁专属报告固定 6 积分），不透传前端值（防改价）；
// - 中枢要求 related_id 必填（1-128字符，如报告ID/交易ID），按 related_id 去重：
//   解锁场景 related_id = 'unlock_report_' + reportId（一人一次，重复返回 consumed:false 已扣过）；
//   其他业务事件 related_id 由前端透传（body.relatedId），缺省用 action+时间戳兜底。
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

  let reason; let amount; let relatedId;
  try {
    const body = (await request.json());
    if (body.action === 'unlock_report' && body.reportId) {
      // 解锁场景：related_id = 报告ID前缀，中枢按 related_id 去重（一人一次，重复请求返回"已扣过"）
      reason = 'unlock_report';
      amount = UNLOCK_REPORT_AMOUNT;
      relatedId = ('unlock_report_' + String(body.reportId)).slice(1, 128);
    } else if (body.action) {
      reason = String(body.action);
      amount = UNLOCK_REPORT_AMOUNT;
      // 其他业务事件：related_id 取前端透传 body.relatedId，缺省用 action+时间戳兜底
      const rid = body.relatedId ? String(body.relatedId) : reason + '_' + Date.now();
      relatedId = rid.slice(0, 128);
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
      body: JSON.stringify({ reason, amount, related_id: relatedId }),
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
