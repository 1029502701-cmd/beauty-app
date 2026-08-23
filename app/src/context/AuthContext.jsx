import { createContext, useState, useEffect, useCallback } from 'react';
import { authApi, clearTokenInvalidFlag } from '../api.js';

export const AuthContext = createContext(null);

const STORAGE_KEY = 'session_token';

function getToken() {
  return localStorage.getItem(STORAGE_KEY);
}

function setToken(token) {
  if (token) {
    localStorage.setItem(STORAGE_KEY, token);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Module-level callback for cross-tree 401 propagation
let currentOnTokenInvalid = null;
export function setOnTokenInvalid(fn) { currentOnTokenInvalid = fn; }

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  // hasPassword 在登录时由父组件传入，持久化到 localStorage
  const [hasPassword, setHasPasswordState] = useState(() => localStorage.getItem('has_password') === 'true');

  useEffect(() => {
    void (async () => {
      const t = getToken();
      if (!t) { setLoading(false); return; }
      setValidating(true);
      try {
        await authApi.probe();
      } catch (e) {
        clearTokenInvalidFlag();
        setToken(null);
        setTokenState(null);
        currentOnTokenInvalid?.();
      } finally {
        setValidating(false);
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (newToken) => {
    setToken(newToken);
    setTokenState(newToken);
  }, []);

  // 设置 hasPassword（登录成功后调用）
  const setHasPassword = useCallback((val) => {
    setHasPasswordState(val);
    localStorage.setItem('has_password', val ? 'true' : 'false');
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    clearTokenInvalidFlag();
    setToken(null);
    setTokenState(null);
    setHasPasswordState(false);
    localStorage.removeItem('has_password');
    currentOnTokenInvalid = null;
  }, []);

  const value = { token, loading, validating, login, logout, hasPassword, setHasPassword };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
