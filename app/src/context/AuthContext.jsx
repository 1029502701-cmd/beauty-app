import { createContext, useState, useEffect, useCallback } from 'react';
import { authApi, clearTokenInvalidFlag } from '../api.js';

export const AuthContext = createContext(null);

const STORAGE_KEY = 'session_token';
const HAS_PW_KEY = 'has_password';

function getToken() { return localStorage.getItem(STORAGE_KEY); }
function setToken(token) {
  if (token) { localStorage.setItem(STORAGE_KEY, token); }
  else { localStorage.removeItem(STORAGE_KEY); }
}

let currentOnTokenInvalid = null;
export function setOnTokenInvalid(fn) { currentOnTokenInvalid = fn; }

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [hasPassword, setHasPasswordState] = useState(() => localStorage.getItem(HAS_PW_KEY) === '1');

  useEffect(() => {
    void (async () => {
      const t = getToken();
      if (!t) { setLoading(false); return; }
      setValidating(true);
      try { await authApi.probe(); }
      catch (e) {
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

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    clearTokenInvalidFlag();
    setToken(null);
    setTokenState(null);
    currentOnTokenInvalid = null;
  }, []);

  const setHasPassword = useCallback((val) => {
    setHasPasswordState(val);
    localStorage.setItem(HAS_PW_KEY, val ? '1' : '0');
  }, []);

  const value = { token, loading, validating, login, logout, hasPassword, setHasPassword };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
