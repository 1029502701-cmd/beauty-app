import { useContext, useEffect, useRef, useState } from 'react';
import { AuthContext, setOnTokenInvalid } from '../context/AuthContext.jsx';

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
      onNavigate('/login');
    }
  }, [forceRedirect, onNavigate]);

  // 无 token 时跳转登录页（必须在条件外，遵守 Rules of Hooks）
  useEffect(() => {
    if (!token && onNavigate && window.location.pathname !== '/login' && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      const origUrl = window.location.href;
      sessionStorage.setItem('auth_redirect_from', origUrl);
      onNavigate('/login');
    }
  }, [token, onNavigate]);

  if (loading || validating) {
    return <div className="loading">加载中...</div>;
  }

  if (!token) {
    return null;
  }

  return children;
}
