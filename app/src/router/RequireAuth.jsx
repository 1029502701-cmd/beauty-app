import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext, setOnTokenInvalid } from '../context/AuthContext.jsx';

// 跳中枢登录（保留当前完整 URL 作为 redirect，登录完回跳）。
// local=1 时走本地登录表单（调试用），不跳中枢。
function redirectToAuthCenter() {
  const useLocalLogin = new URL(window.location.href).searchParams.get('local') === '1';
  if (useLocalLogin) return;
  sessionStorage.setItem('auth_redirect_from', window.location.href);
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

  // 后端 401/403（cookie 里没有有效 token）→ 立即跳中枢
  useEffect(() => {
    if (forceRedirect && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      redirectToAuthCenter();
    }
  }, [forceRedirect]);

  // 启动时 cookie 探测完成但无有效登录态 → 跳中枢
  useEffect(() => {
    if (token || loading || validating) return;
    const timer = setTimeout(() => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      redirectToAuthCenter();
    }, 300);
    return () => clearTimeout(timer);
  }, [token, loading, validating]);

  if (loading || validating) {
    return <div className="loading">加载中...</div>;
  }

  if (!token) {
    return null;
  }

  return children;
}
