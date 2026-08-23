import { useState } from 'react';
import { adminApi } from '../api.js';

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
      localStorage.setItem('admin_session_token', data.sessionId);
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
      <div className="admin-modal" style={{ width: '320px' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: '#111827', textAlign: 'center' }}>
          管理后台
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
          请登录以继续
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <input
              className="admin-config-input"
              style={{ height: '40px', width: '100%' }}
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <input
              className="admin-config-input"
              style={{ height: '40px', width: '100%' }}
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>}
          <button
            type="submit"
            className="admin-btn-save"
            style={{ width: '100%', height: '40px', fontSize: '15px', fontWeight: '600' }}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
