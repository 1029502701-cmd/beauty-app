import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { authApi } from '../api.js';

function isWechatMiniProgram() {
  return typeof wx !== 'undefined' && !!wx.miniProgram;
}

const PHONE_RE = /^1[3-9]\d{9}$/;

export default function Login({ onLogin }) {
  const { login, setHasPassword } = useContext(AuthContext);
  const [mode, setMode] = useState('sms');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  const showWechatLogin = isWechatMiniProgram();

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const startCountdown = useCallback(() => {
    clearInterval(timerRef.current);
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  const handleSendCode = async () => {
    setError('');
    if (!PHONE_RE.test(phone)) { setError('请输入正确的11位手机号'); return; }
    try {
      await authApi.sendCode(phone);
      startCountdown();
    } catch (e) {
      setError(e.message || '发送失败，请重试');
    }
  };

  const handlePhoneLogin = async () => {
    setError('');
    if (!PHONE_RE.test(phone)) { setError('请输入正确的11位手机号'); return; }
    if (code.length !== 6) { setError('请输入6位验证码'); return; }
    if (!agreed) { setError('请先阅读并同意用户协议和隐私政策'); return; }
    setLoading(true);
    try {
      const data = await authApi.phoneLogin(phone, code);
      await login(data.sessionId);
      const hasPwd = !!data.hasPassword;
      setHasPassword(hasPwd);
      if (!hasPwd) {
        window.location.pathname = '/set-password';
        window.history.replaceState({}, '', '/set-password');
        return;
      }
      onLogin?.(sessionStorage.getItem('auth_redirect_from') || null);
      sessionStorage.removeItem('auth_redirect_from');
    } catch (e) {
      if (e.message?.includes('验证码')) { setError('验证码错误，请重新输入'); }
      else if (e.message?.includes('尚未设置')) { setError('该账号尚未设置密码，请切换至密码登录'); }
      else { setError(e.message || '登录失败，请检查网络后重试'); }
    } finally { setLoading(false); }
  };

  const handlePasswordLogin = async () => {
    setError('');
    if (!PHONE_RE.test(phone)) { setError('请输入正确的11位手机号'); return; }
    if (password.length < 6) { setError('密码至少6位'); return; }
    setLoading(true);
    try {
      const data = await authApi.loginPassword(phone, password);
      await login(data.sessionId);
      setHasPassword(true);
      onLogin?.(sessionStorage.getItem('auth_redirect_from') || null);
      sessionStorage.removeItem('auth_redirect_from');
    } catch (e) {
      if (e.message?.includes('尚未设置')) {
        setError('该账号尚未设置密码，请使用验证码登录');
      } else {
        setError('手机号或密码错误');
      }
    } finally { setLoading(false); }
  };

  const canSubmitSms = phone.length === 11 && code.length === 6 && agreed && !loading;
  const canSubmitPw = PHONE_RE.test(phone) && password.length >= 6 && !loading;

  return (
    <div className="login-page">
      <div className="login-header">
        <div className="login-logo">💄</div>
        <h1>美妆App</h1>
        <p className="login-subtitle">发现你的专属美丽</p>
      </div>

      <div className="login-tabs">
        <button
          className={"login-tab" + (mode === "sms" ? " login-tab--active" : "")}
          onClick={() => { setMode("sms"); setError(""); }}
        >验证码登录</button>
        <button
          className={"login-tab" + (mode === "password" ? " login-tab--active" : "")}
          onClick={() => { setMode("password"); setError(""); }}
        >密码登录</button>
      </div>

      <div className="login-form">
        <div className="input-group">
          <input type="tel" className="input-field" placeholder="请输入手机号" maxLength={11} value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setError(""); }} />
        </div>

        {mode === "sms" ? (
          <>
            <div className="input-group input-group--code">
              <input type="tel" className="input-field" placeholder="请输入验证码" maxLength={6} value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }} />
              <button className="code-btn" disabled={countdown > 0} onClick={handleSendCode}>
                {countdown > 0 ? countdown + "s" : "获取验证码"}
              </button>
            </div>
            <label className="agree-label">
              <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); setError(""); }} />
              <span>我已阅读并同意<a href="#">《用户协议》</a>和<a href="#">《隐私政策》</a></span>
            </label>
            <button className="login-btn" disabled={!canSubmitSms} onClick={handlePhoneLogin}>
              {loading ? "登录中..." : "登录"}
            </button>
          </>
        ) : (
          <>
            <div className="input-group">
              <input type="password" className="input-field" placeholder="请输入密码" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} />
            </div>
            <button className="login-btn" disabled={!canSubmitPw} onClick={handlePasswordLogin}>
              {loading ? "登录中..." : "登录"}
            </button>
          </>
        )}

        {error && <p className="error-msg">{error}</p>}
      </div>

      <div className="login-divider"><span>或</span></div>
      {showWechatLogin && (
        <button className="wechat-btn" disabled={loading} onClick={async () => {
          setError(""); setLoading(true);
          try {
            const wxCode = await new Promise((resolve) => { wx.miniProgram.getAuthCode({ success: (res) => resolve(res.code) }); });
            const data = await authApi.wechatLogin(wxCode);
            await login(data.sessionId);
            setHasPassword(true);
            onLogin?.(sessionStorage.getItem("auth_redirect_from") || null);
            sessionStorage.removeItem("auth_redirect_from");
          } catch (e) { setError(e.message || "微信登录失败"); }
          finally { setLoading(false); }
        }}>微信一键登录</button>
      )}
    </div>
  );
}
