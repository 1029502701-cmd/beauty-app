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
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        sessionStorage.setItem('auth_redirect_from', currentPath);
      }
      onNavigate('/login');
    }
  }, [forceRedirect, onNavigate]);

  if (loading || validating) {
    return <div className="loading">加载中...</div>;
  }

  if (!token) {
    useEffect(() => {
      if (onNavigate && window.location.pathname !== '/login' && !hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        sessionStorage.setItem('auth_redirect_from', window.location.pathname);
        onNavigate('/login');
      }
    }, [token, onNavigate]);
    return null;
  }

  return children;
}
