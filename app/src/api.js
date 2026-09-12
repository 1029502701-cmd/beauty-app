export const BASE = '/api';

// Module-level flag: set true when a 401/403 is intercepted, read by RequireAuth
let tokenInvalid = false;
export function clearTokenInvalidFlag() { tokenInvalid = false; }
export function isTokenInvalid() { return tokenInvalid; }

async function request(path, options = {}) {
  const token = localStorage.getItem('session_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      tokenInvalid = true;
      localStorage.removeItem('session_token');
    }
    const msg = data?.message || data?.error || '网络请求失败';
    throw new Error(msg);
  }
  return data;
}

export const authApi = {
  loginPassword: (account, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ account, password }) }),
  // 登录/注册走中枢（本端 /auth/login-or-register 代理到 auth-center，不再本地建号）
  // 首次使用传 isRegister:true（可带 inviteCode）；返回中枢 JWT token
  loginOrRegister: (account, password, opts = {}) =>
    request('/auth/login-or-register', {
      method: 'POST',
      body: JSON.stringify({
        account,
        password,
        ...(opts.isRegister ? { isRegister: true } : {}),
        ...(opts.inviteCode ? { inviteCode: opts.inviteCode } : {}),
      }),
    }),
  sendSmsCode: (phone) => request('/auth/phone/send-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  setPassword: (password) => request('/auth/set-password', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  probe: () => request('/reports/mine', { method: 'GET' }),
  getProfile: () => request('/auth/profile', { method: 'GET' }),
  setProfile: (gender, age_range) => request('/auth/profile', { method: 'POST', body: JSON.stringify({ gender, age_range }) }),
};

// ── Points APIs (via auth-center, cross-origin allowed) ───────────────────────

// Invite APIs
export const inviteApi = {
  getMine: async () => {
    const token = localStorage.getItem('session_token');
    if (!token) throw new Error('未登录');
    const res = await fetch(BASE + '/invite/mine', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        tokenInvalid = true;
        localStorage.removeItem('session_token');
      }
      throw new Error((data.error) || '获取邀请码失败');
    }
    return data;
  },
};
// 固定价格常量（与后端 /api/points/consume 的 UNLOCK_REPORT_AMOUNT 保持一致）
// 仅用于按钮可用性判断；真实扣减金额由服务端决定，前端值不作数。
export const UNLOCK_REPORT_AMOUNT = 6;

// 前端 pointsApi 统一走本端后端代理（/api/points/* → auth-center），
// 不再直连中枢、不再自读 ledger / 另一套 D1。
export const pointsApi = {
  getBalance: async () => {
    const token = localStorage.getItem('session_token');
    if (!token) throw new Error('未登录');
    const res = await fetch(BASE + '/points/balance', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        tokenInvalid = true;
        localStorage.removeItem('session_token');
      }
      throw new Error(data?.error || '获取积分失败');
    }
    return data.balance ?? 0;
  },
  // 查询是否已积分解锁专属报告（本端 tier3_points_unlock 落库），刷新/换设备后恢复资格
  // 同时顺带返回最新积分余额，便于一次性拿到"资格+余额"
  getPointsUnlockStatus: async () => {
    const token = localStorage.getItem('session_token');
    if (!token) throw new Error('未登录');
    const res = await fetch(BASE + '/tier3/points-unlock-status', {
      headers: { Authorization: 'Bearer ' + token },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || '查询解锁状态失败');
    return {
      unlocked: !!data.unlocked,
      source: data.source || null,
      reportRef: data.reportRef || null,
      unlockedAt: data.unlockedAt ?? null,
      balance: typeof data.balance === 'number' ? data.balance : null,
    };
  },
  // 把"已积分解锁"资格落库到本端（幂等），扣积分成功后调用
  recordPointsUnlock: async (reportRef) => {
    const token = localStorage.getItem('session_token');
    if (!token) throw new Error('未登录');
    const res = await fetch(BASE + '/tier3/points-unlock-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ reportRef: reportRef || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || '记录解锁状态失败');
    return data;
  },
  // 解锁专属（3 档）报告：价格/去重由服务端定，前端只传 reportId
  unlockReport: async (reportId) => {
    const token = localStorage.getItem('session_token');
    if (!token) throw new Error('未登录');
    const res = await fetch(BASE + '/points/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'unlock_report', reportId }),
    });
    const data = await res.json().catch(() => ({}));
    // 402 积分不足 / 已解锁 都按"未成功"处理，返回 consumed:false + reason
    if (!res.ok) {
      return {
        consumed: false,
        balance: data.balance ?? null,
        reason: data.reason || data.error || '积分不足或扣减失败',
        status: res.status,
      };
    }
    return {
      consumed: !!data.consumed,
      balance: data.balance ?? null,
      reason: data.reason || '',
    };
  },
};

// ── Admin APIs ──────────────────────────────────────────────────────────────────
const ADMIN_TOKEN_KEY = 'admin_session_token';

function adminRequest(path, options = {}) {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + path, { ...options, headers }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        window.location.href = '/admin/login';
      }
      throw new Error(data?.error || '请求失败');
    }
    return data;
  });
}

export const adminApi = {
  login: (username, password) => adminRequest('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => { localStorage.removeItem(ADMIN_TOKEN_KEY); },
  getToken: () => localStorage.getItem(ADMIN_TOKEN_KEY),
  isInAdmin: () => !!localStorage.getItem(ADMIN_TOKEN_KEY),

  // Influencers
  getInfluencers: (status) => adminRequest('/admin/influencers' + (status ? '?status=' + status : '')),
  approveInfluencer: (id) => adminRequest('/admin/influencers/' + id + '/approve', { method: 'POST' }),
  rejectInfluencer: (id, reason) => adminRequest('/admin/influencers/' + id + '/reject', { method: 'POST', body: JSON.stringify({ reason }) }),

  // Config
  getConfig: () => adminRequest('/admin/config'),
  saveConfig: (key, value) => adminRequest('/admin/config', { method: 'POST', body: JSON.stringify({ key, value }) }),

  // Questionnaire options
  getQuestionnaireOptions: () => adminRequest('/admin/questionnaire-options'),
  saveQuestionnaireOption: (dimension, options) =>
    adminRequest('/admin/questionnaire-options', { method: 'POST', body: JSON.stringify({ dimension, options }) }),
};