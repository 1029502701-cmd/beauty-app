export const BASE = '/api';

// Module-level flag: set true when a 401/403 is intercepted, read by RequireAuth
let tokenInvalid = false;
export function clearTokenInvalidFlag() { tokenInvalid = false; }
export function isTokenInvalid() { return tokenInvalid; }

// 鉴权不再由前端 JS 读/存 token：
//  - 本端 /api/* 同源请求：浏览器自动带上中枢下发的共享域 cookie（auth_token），后端 extractJwt 从 cookie 取 JWT 鉴权；
//  - 中枢 /api/* 跨源请求：带 credentials:"include" 让浏览器自动转发共享域 cookie。
// 前端只在"确认没有有效登录态"时跳 auth.meijian.top 登录（?redirect= 当前页）。
async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(BASE + path, { ...options, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      tokenInvalid = true;
    }
    const msg = data?.message || data?.error || '网络请求失败';
    throw new Error(msg);
  }
  return data;
}

// 检查 cookie 里是否有有效的中枢登录态（后端 /auth/cookie-check 把 cookie 里的 JWT 转给中枢校验）。
export async function cookieHasValidToken() {
  try {
    const res = await fetch(BASE + '/auth/cookie-check', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    return !!data.ok;
  } catch {
    return false;
  }
}

export const authApi = {
  // 登录/注册走中枢两个独立接口（本端 /auth/login、/auth/register 为纯透传代理，不做转换/缓存），
  // 返回中枢签发的 JWT；前端按"已注册/未注册"状态分别调对应接口，不再共用一个"提交"按钮自动判断。
  login: (account, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ account, password }) }),
  register: (account, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    }),
  // 补全/更新性别、年龄段：本端 /auth/profile 纯透传到中枢 PUT /api/auth/profile
  setProfile: (gender, age_range) =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify({ gender, age_range }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  // 登录态探测：cookie 里是否有有效中枢登录态（后端转中枢校验）
  probe: () => cookieHasValidToken(),
};// ── Points APIs (via auth-center, cross-origin allowed) ───────────────────────
// 鉴权统一走 cookie：本端 /api/* 同源（浏览器自动带共享域 cookie），
// 中枢 AUTH_POINTS_BASE/* 跨源用 credentials:"include" 转发共享域 cookie。前端不读/不存 token。

// 跨源中枢请求统一包装：带 credentials 转发 cookie，401/403 置 tokenInvalid 标记。
// 跨源中枢请求统一走本端 /api/* 代理（同源，浏览器自动带共享域 cookie）。
// 前端不再直连 AUTH_POINTS_BASE，避免 CORS credentials 限制。
async function authCenterFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(BASE + path, { ...options, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) tokenInvalid = true;
    throw new Error(data?.error || data?.reason || '请求失败');
  }
  return data;
}

// Invite APIs
export const inviteApi = {
  // 兑换他人邀请码（注册后的独立步骤）：本端 /invite/redeem 纯透传到中枢 /api/invite/redeem（cookie 鉴权）
  redeem: async (inviteCode) => {
    const res = await fetch(BASE + '/invite/redeem', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) tokenInvalid = true;
      return { ok: false, error: data.error || '兑换失败' };
    }
    return { ok: true, data };
  },
  getMine: async () => {
    const res = await fetch(BASE + '/invite/mine', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) tokenInvalid = true;
      throw new Error((data.error) || '获取邀请码失败');
    }
    return data;
  },
};
// 固定价格常量（与后端 /api/points/consume 的 UNLOCK_REPORT_AMOUNT 保持一致）
// 仅用于按钮可用性判断；真实扣减金额由服务端决定，前端值不作数。
export const UNLOCK_REPORT_AMOUNT = 6;


// 画像标签（脸型/肤质/妆容风格等）统一走中枢 /api/profile/facts，本端不缓存副本。
// 读取时不要假设某个 key 一定有值（其他项目写的标签本端可能没有）。
export const profileApi = {
  getFacts: async () => {
    const data = await authCenterFetch('/api/profile/facts');
    return data.facts || [];
  },
  writeFacts: async (facts) => {
    const data = await authCenterFetch('/api/profile/facts', {
      method: 'POST',
      body: JSON.stringify({ source_project: '美妆app', facts }),
    });
    return data;
  },
};

// ── 中枢直连（BEIZHUANG_INTEGRATION）：同域 .meijian.top cookie 天然可达，读 auth_token 带 Bearer 跨域调用 ─
// ① 读 cookie（美妆前端在 beauty.meijian.top 下可读到 .meijian.top 域的 cookie）
export function getAuthToken() {
  const m = document.cookie.match(/(?:^|; )auth_token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// ② 调中枢（跨域带 token）；401 说明没登录或 token 过期 → 跳中枢登录页
const AUTH_HUB = 'https://auth.meijian.top';
export async function hubFetch(path, body) {
  const token = getAuthToken();
  const res = await fetch(AUTH_HUB + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    tokenInvalid = true;
    window.open(AUTH_HUB + '/login?redirect=' + encodeURIComponent(window.location.href), '_blank');
    throw new Error('未登录');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data?.error || data?.reason || '中枢请求失败'), { status: res.status, data });
  }
  return res.json();
}

// 积分接口统一入口：cookie 里能读到 auth_token → 中枢直连（hubFetch）；
// 读不到（cookie 是 HttpOnly、或本地开发跨域限制）→ 退回本端 /api 代理
//（服务端从共享 cookie 取 JWT 转发中枢），功能不断。
async function pointsFetch(path, options = {}) {
  if (getAuthToken()) {
    try {
      return await hubFetch(path, options.body !== undefined ? options.body : null);
    } catch (err) {
      if (err && typeof err.status === "number" && err.status >= 400) throw err;
      return authCenterFetch(path, options);
    }
  }
  return authCenterFetch(path, options);
}

// 前端 pointsApi：积分读/扣走中枢直连（cookie 有 auth_token 时 hubFetch 直连 auth.meijian.top），读不到 token 自动退回本端代理；
// 解锁资格记录仍走本端 /api/tier3/points-unlock-*（本端 D1 台账）。
export const pointsApi = {
  getBalance: async () => {
    // 无有效登录态（cookie 里没有 token）：跳中枢登录（带 ?redirect= 当前页）
    if (!(await cookieHasValidToken())) {
      if (new URL(window.location.href).searchParams.get('local') !== '1') {
        const target = encodeURIComponent(window.location.href);
        window.location.href = 'https://auth.meijian.top?redirect=' + target;
      }
      throw new Error('未登录');
    }
    const data = await pointsFetch('/api/points/balance');
    return data.balance ?? 0;
  },
  // 查询是否已积分解锁专属报告（本端 tier3_points_unlock 落库），刷新/换设备后恢复资格
  // 同时顺带返回最新积分余额，便于一次性拿到"资格+余额"
  getPointsUnlockStatus: async () => {
    const res = await fetch(BASE + '/tier3/points-unlock-status', { credentials: 'include' });
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
    const res = await fetch(BASE + '/tier3/points-unlock-record', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportRef: reportRef || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || '记录解锁状态失败');
    return data;
  },
  // 解锁专属（3 档）报告：动作成功那一刻调中枢 /api/points/consume（cookie 有 auth_token 时 hubFetch 直连，
  // 否则走本端 /api/points/consume 代理；金额/去重服务端写死，前端只传 reportId，防改价）。
  // 402 积分不足 / 已扣过 都按"未成功"处理，返回 consumed:false + reason + balance。
  unlockReport: async (reportId) => {
    const body = { action: 'unlock_report', reportId };
    const fallback = async () => {
      const res = await fetch(BASE + '/points/consume', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
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
    };
    if (getAuthToken()) {
      // 直连中枢：本端 consume 代理的服务端语义 = 中枢 /api/points/consume（amount 服务端定、related_id 去重）
      try {
        const data = await hubFetch('/api/points/consume', {
          reason: 'unlock_report',
          amount: UNLOCK_REPORT_AMOUNT,
          related_id: 'unlock_report_' + String(reportId),
        });
        return {
          consumed: !!data.consumed,
          balance: data.balance ?? null,
          reason: data.reason || '',
        };
      } catch (err) {
        if (err && typeof err.status === 'number' && err.status >= 400) {
          // 中枢明确拒绝（402 积分不足等）：按未成功处理，直接返回
          const d = err.data || {};
          return {
            consumed: false,
            balance: typeof d.balance === 'number' ? d.balance : null,
            reason: d.reason || d.error || err.message || '积分不足或扣减失败',
            status: err.status,
          };
        }
        return fallback(); // 网络/CORS 异常 → 退回本端代理
      }
    }
    return fallback();
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

  // Tier3 兑换码管理
  generateTier3Codes: (count) =>
    adminRequest('/admin/tier3-codes/generate', { method: 'POST', body: JSON.stringify({ count }) }),
  listTier3Codes: () => adminRequest('/admin/tier3-codes'),
};
