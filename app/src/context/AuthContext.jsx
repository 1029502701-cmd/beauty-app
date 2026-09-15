import { createContext, useState, useEffect, useCallback } from 'react';
import { authApi, cookieHasValidToken, clearTokenInvalidFlag } from '../api.js';

export const AuthContext = createContext(null);

// 登录态不再由前端 localStorage 保存：
// 中枢（auth.meijian.top）登录后下发的共享域 cookie 由浏览器自动携带，
// 前端只需用后端 /auth/cookie-check（cookieHasValidToken）探测"cookie 里有没有有效 token"。
let currentOnTokenInvalid = null;
export function setOnTokenInvalid(fn) { currentOnTokenInvalid = fn; }

export function AuthProvider({ children }) {
  // token 现在表示"cookie 中是否存在有效中枢登录态"（布尔语义），
  // 保留 loading/validating 以维持下游 RequireAuth 逻辑不变。
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    void (async () => {
      setValidating(true);
      try {
        const ok = await cookieHasValidToken();
        setTokenState(ok ? 'cookie' : null);
        if (!ok) clearTokenInvalidFlag();
      } catch (e) {
        clearTokenInvalidFlag();
        setTokenState(null);
        currentOnTokenInvalid?.(); // 触发 RequireAuth 立即跳中枢，避免 401 请求风暴
      } finally {
        setValidating(false);
        setLoading(false);
      }
    })();
  }, []);

  // login 保留为"标记已登录"（cookie 方案下登录态由中枢 cookie 决定，这里只用于刷新本地态）
  const login = useCallback(async () => {
    const ok = await cookieHasValidToken().catch(() => false);
    setTokenState(ok ? 'cookie' : null);
  }, []);

  const logout = useCallback(async () => {
    // 中枢侧清除登录态（尽力而为）；本端不再持有 token 可删
    try { await authApi.logout(); } catch {}
    clearTokenInvalidFlag();
    setTokenState(null);
    currentOnTokenInvalid = null;
  }, []);

  const value = { token, loading, validating, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
