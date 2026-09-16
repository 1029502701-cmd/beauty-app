import { useState } from 'react';
import { adminApi } from '../api.js';
import { setStorageItem, STORAGE_KEYS } from '../utils/storage.js';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await adminApi.login(username, password);
      await setStorageItem(STORAGE_KEYS.ADMIN_SESSION_TOKEN, data.sessionId);
      window.history.replaceState(null, '', '/admin/dashboard');
      window.location.href = '/admin/dashboard';
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <span className="admin-login-icon">💄</span>
          <h1>管理后台</h1>
          <p className="admin-login-sub">美妆报告系统 · 请登录以继续</p>
        </div>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <div className="admin-input-group">
            <label htmlFor="admin-username">用户名</label>
            <input
              id="admin-username"
              className="admin-input"
              type="text"
              placeholder="请输入用户名"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="admin-input-group">
            <label htmlFor="admin-password">密码</label>
            <input
              id="admin-password"
              className="admin-input"
              type="password"
              placeholder="请输入密码"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="admin-error">⚠ {error}</p>}
          <button
            type="submit"
            className="admin-login-btn"
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
