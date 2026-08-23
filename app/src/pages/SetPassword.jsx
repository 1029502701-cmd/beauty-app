import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { authApi } from '../api.js';

export default function SetPassword({ onSet }) {
  const { setHasPassword } = useContext(AuthContext);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validate = () => {
    if (password.length < 6) return '密码至少6位';
    if (!/[a-zA-Z]/.test(password)) return '密码需包含字母';
    if (!/[0-9]/.test(password)) return '密码需包含数字';
    if (password !== confirm) return '两次输入的密码不一致';
    return null;
  };

  const handleSubmit = async () => {
    setError('');
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      await authApi.setPassword(password);
      setHasPassword(true);
      onSet?.();
    } catch (e) {
      setError(e.message || '设置失败，请重试');
    } finally { setLoading(false); }
  };

  const strong = password.length >= 6 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

  return (
    <div className="setpw-page">
      <div className="setpw-header">
        <button className="setpw-back" onClick={() => window.history.back()}>←</button>
        <h1 className="setpw-title">设置密码</h1>
        <div className="setpw-spacer" />
      </div>
      <div className="setpw-form">
        <p className="setpw-hint">设置密码后可用手机号+密码登录</p>
        <div className="setpw-field">
          <label className="setpw-label">新密码</label>
          <div className="setpw-input-wrap">
            <input
              type={showPw ? 'text' : 'password'}
              className="setpw-input"
              placeholder="至少6位，含字母和数字"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
            />
            <button className="setpw-eye" onClick={() => setShowPw(!showPw)} type="button">
              {showPw ? '隐藏' : '显示'}
            </button>
          </div>
        </div>
        <div className="setpw-field">
          <label className="setpw-label">确认密码</label>
          <div className="setpw-input-wrap">
            <input
              type={showConfirm ? 'text' : 'password'}
              className="setpw-input"
              placeholder="再次输入密码"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(''); }}
            />
            <button className="setpw-eye" onClick={() => setShowConfirm(!showConfirm)} type="button">
              {showConfirm ? '隐藏' : '显示'}
            </button>
          </div>
        </div>
        {password && (
          <div className={"setpw-strength" + (strong ? ' setpw-strength--ok' : ' setpw-strength--weak')}>
            {strong ? '✓ 密码强度符合要求' : '密码需至少6位且同时包含字母和数字'}
          </div>
        )}
        {error && <p className="setpw-error">{error}</p>}
        <button
          className="setpw-btn"
          disabled={!strong || confirm.length === 0 || loading}
          onClick={handleSubmit}
        >
          {loading ? '设置中...' : '确认设置'}
        </button>
      </div>
    </div>
  );
}
