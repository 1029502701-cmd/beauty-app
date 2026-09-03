import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { authApi } from '../api.js';

const PHONE_RE = /^1[3-9]\d{9}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidAccount(s) { return PHONE_RE.test(s) || EMAIL_RE.test(s); }
function isValidPhone(s) { return PHONE_RE.test(s); }

const GENDERS = [
  { value: 'female', label: '女生' },
  { value: 'male', label: '男生' },
];
const AGE_RANGES = [
  { value: '18-24', label: '18-24岁' },
  { value: '25-30', label: '25-30岁' },
  { value: '31-35', label: '31-35岁' },
  { value: '36-40', label: '36-40岁' },
  { value: '40+', label: '40岁以上' },
];

export default function Login({ onLogin }) {
  const { login } = useContext(AuthContext);
  const [tab, setTab] = useState('password');
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [needPassword, setNeedPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSending, setCodeSending] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);

  // Profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState(null);
  const [selectedGender, setSelectedGender] = useState('');
  const [selectedAgeRange, setSelectedAgeRange] = useState('');

  useEffect(() => {
    fetch('/api/config/sms_login_enabled')
      .then(r => r.json())
      .then(data => { if (data.value === 'true') setSmsEnabled(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (codeCountdown <= 0) return;
    const timer = setTimeout(() => setCodeCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [codeCountdown]);

  const finishLogin = async (sessionId) => {
    await login(sessionId);
    onLogin?.(sessionStorage.getItem('auth_redirect_from') || null);
    sessionStorage.removeItem('auth_redirect_from');
  };

  const checkProfile = async (sessionId) => {
    try {
      const res = await fetch('/api/auth/profile', {
        headers: { 'Authorization': 'Bearer ' + sessionId },
      });
      const data = await res.json();
      if (!res.ok) return true; // assume complete on error
      if (data.completed) return true;
      // Not complete — show modal
      setPendingSessionId(sessionId);
      setShowProfileModal(true);
      return false;
    } catch {
      return true;
    }
  };

  const handleAutoLogin = async () => {
    setError('');
    setNeedPassword(false);
    if (!isValidAccount(account)) { setError('请输入正确的手机号或邮箱'); return; }
    setLoading(true);
    try {
      const url = '/api/auth/auto-login?account=' + encodeURIComponent(account);
      const finalUrl = password ? url + '&password=' + encodeURIComponent(password) : url;
      const res = await fetch(finalUrl);
      const data = await res.json();
      if (data.needPassword) {
        setNeedPassword(true);
        if (!res.ok) setError(data.error || '需要密码');
        return;
      }
      if (!res.ok) throw new Error(data.error || '登录失败');
      const isLoggedIn = await checkProfile(data.sessionId);
      if (isLoggedIn) await finishLogin(data.sessionId);
    } catch (e) { setError(e.message || '登录失败，请重试'); }
    finally { setLoading(false); }
  };

  const handleSendCode = async () => {
    setError('');
    if (!isValidPhone(phone)) { setError('请输入正确的手机号'); return; }
    setCodeSending(true);
    try { await authApi.sendSmsCode(phone); setCodeCountdown(60); }
    catch (e) { setError(e.message || '发送失败，请重试'); }
    finally { setCodeSending(false); }
  };

  const handleSmsSubmit = async () => {
    setError('');
    if (!isValidPhone(phone)) { setError('请输入正确的手机号'); return; }
    if (!code || code.length !== 6) { setError('请输入6位验证码'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/phone/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登录失败');
      const isLoggedIn = await checkProfile(data.sessionId);
      if (isLoggedIn) await finishLogin(data.sessionId);
    } catch (e) { setError(e.message || '登录失败，请重试'); }
    finally { setLoading(false); }
  };

  const handleProfileSubmit = async () => {
    if (!selectedGender || !selectedAgeRange) return;
    setLoading(true);
    try {
      await authApi.setProfile(selectedGender, selectedAgeRange);
      setShowProfileModal(false);
      await finishLogin(pendingSessionId);
    } catch (e) { setError(e.message || '保存失败，请重试'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-header">
        <div className="login-logo">💄</div>
        <h1>美妆App</h1>
        <p className="login-subtitle">发现你的专属美丽</p>
      </div>

      {smsEnabled && (
        <div className="login-tabs">
          <button className={"login-tab" + (tab === "password" ? " login-tab--active" : "")} onClick={() => { setTab("password"); setError(""); }}>一键登录</button>
          <button className={"login-tab" + (tab === "sms" ? " login-tab--active" : "")} onClick={() => { setTab("sms"); setError(""); }}>验证码登录</button>
        </div>
      )}

      <div className="login-form">
        {tab === "password" ? (
          <>
            <div className="input-group">
              <input type="text" className="input-field" placeholder="手机号 / 邮箱" value={account} onChange={(e) => { setAccount(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") handleAutoLogin(); }} />
            </div>
            {needPassword && (
              <div className="input-group">
                <input type="password" className="input-field" placeholder="请输入密码" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} onKeyDown={(e) => { if (e.key === "Enter") handleAutoLogin(); }} />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="input-group input-group--code">
              <input type="text" className="input-field" placeholder="请输入手机号" value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }} maxLength={11} />
              <button className="code-btn" disabled={codeSending || codeCountdown > 0} onClick={handleSendCode}>
                {codeCountdown > 0 ? codeCountdown + "s" : "获取验证码"}
              </button>
            </div>
            <div className="input-group">
              <input type="text" className="input-field" placeholder="请输入6位验证码" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} maxLength={6} onKeyDown={(e) => { if (e.key === "Enter") handleSmsSubmit(); }} />
            </div>
          </>
        )}

        {error && <p className="error-msg">{error}</p>}

        {tab === "password" ? (
          <button className="login-btn" disabled={loading || !isValidAccount(account)} onClick={handleAutoLogin}>
            {loading ? "登录中..." : (needPassword ? "确认登录" : "登录 / 注册")}
          </button>
        ) : (
          <button className="login-btn" disabled={loading || !isValidPhone(phone) || code.length !== 6} onClick={handleSmsSubmit}>
            {loading ? "登录中..." : "登录"}
          </button>
        )}
      </div>

      {showProfileModal && (
        <div className="profile-modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="profile-modal-title">完善个人信息</h2>
            <p className="profile-modal-hint">选择性别和年龄段，为你推荐更精准的美妆方案</p>
            <div className="profile-modal-section">
              <label className="profile-modal-label">性别</label>
              <div className="profile-modal-options">
                {GENDERS.map(g => (
                  <button key={g.value} className={"profile-modal-option" + (selectedGender === g.value ? " profile-modal-option--active" : "")}
                    onClick={() => setSelectedGender(g.value)}>{g.label}</button>
                ))}
              </div>
            </div>
            <div className="profile-modal-section">
              <label className="profile-modal-label">年龄段</label>
              <div className="profile-modal-options">
                {AGE_RANGES.map(a => (
                  <button key={a.value} className={"profile-modal-option" + (selectedAgeRange === a.value ? " profile-modal-option--active" : "")}
                    onClick={() => setSelectedAgeRange(a.value)}>{a.label}</button>
                ))}
              </div>
            </div>
            <button className="profile-modal-btn" disabled={!selectedGender || !selectedAgeRange || loading}
              onClick={handleProfileSubmit}>
              {loading ? "保存中..." : "完成"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}