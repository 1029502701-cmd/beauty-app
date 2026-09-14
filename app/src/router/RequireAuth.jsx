import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext, setOnTokenInvalid } from '../context/AuthContext.jsx';

// 外部鉴权模式：跳中枢登录页（保留当前 URL 作为 redirect，登录后回跳）
function redirectToAuthCenter() {
  const useLocalLogin = new URL(window.location.href).searchParams.get('local') === '1';
  if (useLocalLogin) return; // 本地调试模式不跳中枢
  const target = encodeURIComponent(window.location.href);
  window.location.href = 'https://auth.meijian.top?redirect=' + target;
}

export default function RequireAuth({ children, fallbackPath = '/home', onNavigate }) {
  const { token, loading, validating } = useContext(AuthContext);
  const [forceRedirect, setForceRedirect] = useState(false);
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    const fn = () => setForceRedirect(true);
    setOnTokenInvalid(fn);
    return () => setOnTokenInvalid(null);
  }, []);

  // token 失效跳转登录页
  useEffect(() => {
    if (forceRedirect && onNavigate && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      const currentPath = window.location.href;
      if (currentPath !== '/login') {
        sessionStorage.setItem('auth_redirect_from', currentPath);
      }
      redirectToAuthCenter();
    }
  }, [forceRedirect, onNavigate]);

  // 无 token 时跳转登录页（必须在条件外，遵守 Rules of Hooks）
  // 300ms 延迟：等 App.jsx token-effect 处理完 URL 中 ?token=... 回调再决定是否跳转，
  // 避免抢先重定向到中枢导致回跳失败。
  useEffect(() => {
    if (token || loading || validating || !onNavigate || window.location.pathname === '/login') return;
    const timer = setTimeout(() => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      const origUrl = window.location.href;
      sessionStorage.setItem('auth_redirect_from', origUrl);
      redirectToAuthCenter();
    }, 300);
    return () => clearTimeout(timer);
  }, [token, loading, validating, onNavigate]);

  if (loading || validating) {
    return <div className="loading">加载中...</div>;
  }

  if (!token) {
    return null;
  }

  return children;
}
