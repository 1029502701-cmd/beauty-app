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
  loginOrRegister: (account, password, confirmPassword) => request('/auth/login-or-register', { method: 'POST', body: JSON.stringify({ account, password, confirmPassword }) }),
  sendSmsCode: (phone) => request('/auth/phone/send-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  setPassword: (password) => request('/auth/set-password', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  probe: () => request('/reports/mine', { method: 'GET' }),
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
