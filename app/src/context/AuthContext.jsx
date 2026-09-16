import { createContext, useState, useEffect, useCallback } from 'react';
import { isLoggedIn, clearTokenInvalidFlag, pointsApi } from '../api.js';

export const AuthContext = createContext(null);

// 纯前端登录态：cookie 里存在 auth_token（Domain=.meijian.top，中枢登录写入，14 天）即已登录，
// 不再调本端 /auth/cookie-check 探测。?local=1 本地调试时跳过，保留本地登录表单。
let currentOnTokenInvalid = null;
export function setOnTokenInvalid(fn) { currentOnTokenInvalid = fn; }

const useLocalDebug = new URL(window.location.href).searchParams.get('local') === '1';

export function AuthProvider({ children }) {
  // token 布尔语义：cookie 里是否有中枢共享 cookie。保留 loading/validating 以维持下游 RequireAuth 逻辑不变。
  const [token, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    void (async () => {
      setValidating(true);
      if (useLocalDebug) {
        // 本地调试：不进中枢 cookie 判断，保留本地表单流程（原行为）
        setTokenState(null);
        setValidating(false);
        setLoading(false);
        return;
      }
      try {
        const ok = isLoggedIn();
        setTokenState(ok ? 'cookie' : null);
        if (!ok) clearTokenInvalidFlag();
        // 进一步确认：cookie 有 token 但可能已失效，用中枢 balance 做一次轻校验（失败不阻断）
        if (ok) {
          try { await pointsApi.getBalance(); } catch {}
        }
      } catch {
        clearTokenInvalidFlag();
        setTokenState(null);
      } finally {
        setValidating(false);
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async () => {
    setTokenState(isLoggedIn() ? 'cookie' : null);
  }, []);

  const logout = useCallback(async () => {
    // 本端不再持有 token（登录态在中枢共享 cookie），本地清状态即可；
    // 中枢侧登出由用户在中枢门户主动操作（cookie 清除后刷新本端自动变回未登录）。
    clearTokenInvalidFlag();
    setTokenState(null);
    currentOnTokenInvalid = null;
  }, []);

  const value = { token, loading, validating, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}