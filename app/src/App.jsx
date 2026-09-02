import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext, AuthProvider } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Capture from './pages/Capture.jsx';
import Tier1Result from './pages/Tier1Result.jsx';
import Tier2Result from './pages/Tier2Result.jsx';
import ReportPage from './pages/ReportPage.jsx';
import InfluencerApply from './pages/InfluencerApply.jsx';
import RequireAuth from './router/RequireAuth.jsx';
import AdminRequireAuth from './router/AdminRequireAuth.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

function Router() {
    const { token, loading, logout, login } = useContext(AuthContext);
  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem('auth_redirect_from');
    const path = window.location.pathname;
    return saved || (path === '/' ? '' : path) || '/login';
  });
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path !== page) setPage(path === '' ? '/home' : path);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [page]);

  // Track the last redirect target set by handleLogin to avoid race conditions
  const loginRedirectTargetRef = useRef(null);

  // tokenProcessRef MUST be declared BEFORE handleLogout (const is not hoisted)
  const tokenProcessRef = useRef(false);

  // Extract token from URL at render time (synchronous, before any effect runs)
  // Both effects read from this ref to avoid stale-closure / URL-modification race
  const callbackTokenRef = useRef(null);
  if (callbackTokenRef.current === null) {
    callbackTokenRef.current = new URL(window.location.href).searchParams.get('token');
  }

  const handleLogin = (redirectFrom) => {
    const target = redirectFrom || '/home';
    loginRedirectTargetRef.current = target;
    sessionStorage.removeItem('auth_redirect_from');
    setPage(target);
    window.history.replaceState(null, '', target);
  };

  const handleLogout = async () => {
    console.log('[DIAG] handleLogout START');
    await logout();
    sessionStorage.removeItem('auth_redirect_from');
    tokenProcessRef.current = false;
    loginRedirectTargetRef.current = null;
    setPage('/login');
    window.history.replaceState(null, '', '/login');
    console.log('[DIAG] handleLogout DONE tokenProcessRef=', tokenProcessRef.current);
  };

  // Handle token returned from auth.meijian.top
  // MUST run before the auth-effect below so redirect param is read before token is stored
  useEffect(() => {
    console.log('[DIAG] token-effect fired', { tokenProcessRef: tokenProcessRef.current, loading, hasToken: !!token, callbackTokenFromRef: callbackTokenRef.current });
    if (tokenProcessRef.current || loading) {
      console.log('[DIAG] token-effect EARLY RETURN tokenProcessRef=', tokenProcessRef.current, 'loading=', loading);
      return;
    }
    const callbackToken = callbackTokenRef.current;
    console.log('[DIAG] token-effect URL search', { token, callbackTokenFromRef: callbackToken });
    if (callbackToken) {
      tokenProcessRef.current = true;
      console.log('[DIAG] token-effect FOUND token, setting ref=true');
      const redirectFrom = new URL(window.location.href).searchParams.get('redirect');
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState(null, '', url.toString());
      login(callbackToken);
      const target = redirectFrom ? decodeURIComponent(redirectFrom) : '/home';
      setPage(target === '/home' ? '' : target);
      window.history.replaceState(null, '', target === '/home' ? '/' : target);
      console.log('[DIAG] token-effect processed token target=', target);
    }
  }, [loading, login]);

  useEffect(() => {
    console.log('[DIAG] auth-guard effect', { token, loading, page, tokenProcessRef: tokenProcessRef.current, effectivePath: window.location.pathname === '/' ? '' : window.location.pathname });
    if (!loading) {
      const path = window.location.pathname;
      const effectivePath = path === '/' ? '' : path;
      // Unauthenticated: redirect to unified login (auth.meijian.top)
      if (!token && effectivePath !== '/login' && effectivePath !== '/admin/login' && !effectivePath.startsWith('/admin')) {
        console.log('[DIAG] auth-guard REDIRECT to auth (no token, path=', effectivePath, ')');
        const target = encodeURIComponent(window.location.origin + effectivePath || '/');
        window.location.href = 'https://auth.meijian.top?redirect=' + target;
      }
      // Authenticated: redirect root / to /home (skip while processing callback token)
      else if (!tokenProcessRef.current && token && (effectivePath === '' || effectivePath === '/')) {
        console.log('[DIAG] auth-guard redirect root to /home');
        setPage('/home');
        window.history.replaceState(null, '', '/home');
      }
      else if (token && effectivePath !== '/login' && effectivePath !== page && !loginRedirectTargetRef.current) {
        // Sync URL on direct navigation while authenticated (e.g. refresh)
        console.log('[DIAG] auth-guard sync page', { effectivePath, page });
        setPage(effectivePath);
      }
      else if (!token && effectivePath === '/login') {
        // Use the originally-intended URL saved by RequireAuth BEFORE it navigated to /login
        console.log('[DIAG] auth-guard at /login no token');
        const storedRedirect = sessionStorage.getItem('auth_redirect_from');
        const target = storedRedirect
          ? encodeURIComponent(storedRedirect)
          : encodeURIComponent(window.location.origin + (effectivePath || '/'));
        window.location.href = 'https://auth.meijian.top?redirect=' + target;
      }
      else {
        console.log('[DIAG] auth-guard NO ACTION tokenProcessRef=', tokenProcessRef.current);
      }
    }
  }, [token, loading]);

  if (loading) return <div className="loading">加载中...</div>;

  if (page === '/admin/login') return <AdminLogin />;
  if (page === '/admin/dashboard') return <AdminRequireAuth><AdminDashboard /></AdminRequireAuth>;

  // Authenticated users landing on root /
  if (token && (page === '' || page === '/')) return <Home onLogout={handleLogout} />;

  const renderPage = () => {
    // Login page removed from routing — external auth via auth.meijian.top
    return (
      <RequireAuth
        fallbackPath="/home"
        onNavigate={(path) => {
          setPage(path);
          window.history.replaceState(null, '', path);
        }}
      >
        {page === '/home' && <Home onLogout={handleLogout} />}
        {page === '/capture' && <Capture />}
        {page === '/tier1-result' && <Tier1Result />}
        {page === '/tier2-result' && <Tier2Result />}
        {(page === '/report' || page.startsWith('/report/')) && <ReportPage />}
        {page === '/influencer-apply' && <InfluencerApply />}
      </RequireAuth>
    );
  };

  return renderPage();
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}


