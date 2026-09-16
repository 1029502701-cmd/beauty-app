import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { authApi, inviteApi } from '../api.js';

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidAccount(s) { return PHONE_RE.test(s) || EMAIL_RE.test(s); }

// 登录/注册：注册走中枢 /api/auth/register，登录走 /api/auth/login（中枢两个独立接口，不做自动判断）。
// 依据"首次使用是否带过邀请码"区分新用户/老用户：新用户默认走注册表单，老用户默认走登录表单。
export default function Login({ onLogin }) {
  const { login } = useContext(AuthContext);
  const [mode, setMode] = useState(() => (sessionStorage.getItem('invite_code') ? 'register' : 'login'));
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!isValidAccount(account)) { setError('请输入正确的手机号或邮箱'); return; }
    if (!password || password.length < 6) { setError('请设置密码（至少6位，含字母和数字）'); return; }
    setLoading(true);
    try {
      const inviteCode = sessionStorage.getItem('invite_code') || '';
      // 注册与兑换解耦：注册只提交账号密码；邀请码兑换是注册成功后的独立步骤（中枢 /api/invite/redeem）。
      const res = mode === 'register'
        ? await authApi.register(account, password)
        : await authApi.login(account, password);
      const token = res?.token;
      if (!token) throw new Error(res?.error || '登录失败');
      if (inviteCode) {
        // 仅注册路径尝试兑换一次；失败（如已兑换过/自邀）不阻断登录，静默忽略。
        try { await inviteApi.redeem(inviteCode); } catch (e) { console.warn('invite redeem skipped:', e?.message); }
      }
      sessionStorage.removeItem('invite_code');
      await login(token);
      onLogin?.(sessionStorage.getItem('auth_redirect_from') || null);
      sessionStorage.removeItem('auth_redirect_from');
    } catch (e) {
      setError(e.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-header">
        <div className="login-logo">💄</div>
        <h1>美妆App</h1>
        <p className="login-subtitle">发现你的专属美丽</p>
      </div>
      <div className="login-form">
        <div className="input-group">
          <input type="text" className="input-field" placeholder="手机号 / 邮箱" value={account}
            onChange={(e) => { setAccount(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </div>
        <div className="input-group">
          <input type="password" className="input-field" placeholder="密码（至少6位，含字母和数字）" value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button className="login-btn" disabled={loading || !isValidAccount(account) || password.length < 6} onClick={submit}>
          {loading ? '处理中...' : (mode === 'register' ? '注册并登录' : '登录')}
        </button>
        <button type="button" className="login-divider" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>
          <span>{mode === 'register' ? '已有账号？去登录' : '还没有账号？去注册'}</span>
        </button>
      </div>
    </div>
  );
}
