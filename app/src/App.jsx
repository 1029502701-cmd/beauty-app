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
import SetPassword from './pages/SetPassword.jsx';
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
    await logout();
    sessionStorage.removeItem('auth_redirect_from');
    tokenProcessRef.current = false;
    callbackTokenRef.current = null;
    loginRedirectTargetRef.current = null;
    const target = '/home';
    setPage(target);
    window.history.replaceState(null, '', target);
  };

  // Handle token returned from auth.meijian.top
  // MUST run before the auth-effect below so redirect param is read before token is stored
  useEffect(() => {
    if (tokenProcessRef.current || loading) {
      return;
    }
    const callbackToken = callbackTokenRef.current;
    if (callbackToken) {
      tokenProcessRef.current = true;
      const redirectFrom = new URL(window.location.href).searchParams.get('redirect');
      // 从回调 URL 中提取 invite 参数，供登录页使用
      const inviteCode = new URL(window.location.href).searchParams.get('invite');
      if (inviteCode) sessionStorage.setItem('invite_code', inviteCode);
      login(callbackToken);
// Parse the redirect param from auth-center bounce:
//  - same-origin redirect: use its pathname as the target page
//  - cross-origin redirect: fall back to /home (avoids replaceState DOMException)
let targetPath = '/home';
if (redirectFrom) {
  try {
    const u = new URL(redirectFrom);
    if (u.origin === window.location.origin) targetPath = u.pathname || '/';
  } catch (_) { /* ignore */ }
}
// Clean the current URL query string (keep pathname)
const cleanUrl = new URL(window.location.href);
cleanUrl.search = '';
window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.hash);
const normalized = (targetPath === '/' || targetPath === '/home') ? '' : targetPath;
setPage(normalized);
if (normalized) window.history.replaceState(null, '', normalized);
    }
  }, [loading, login]);

  useEffect(() => {
    if (!loading) {
      const path = window.location.pathname;
      const effectivePath = path === '/' ? '' : path;
      // Unauthenticated: redirect to unified login (auth.meijian.top)
      if (!token && callbackTokenRef.current === null && effectivePath !== '/login' && effectivePath !== '/set-password' && effectivePath !== '/admin/login' && !effectivePath.startsWith('/admin')) {
        const target = encodeURIComponent(window.location.href || '/');
        const useLocalLogin = new URL(window.location.href).searchParams.get('local') === '1';
        if (!useLocalLogin) {
          window.location.href = 'https://auth.meijian.top?redirect=' + target;
        }
      } else if (!tokenProcessRef.current && token && (effectivePath === '' || effectivePath === '/')) {
        setPage('/home');
        window.history.replaceState(null, '', '/home');
      }
      else if (token && effectivePath !== '/login' && effectivePath !== page && !loginRedirectTargetRef.current) {
        // Sync URL on direct navigation while authenticated (e.g. refresh)
        setPage(effectivePath);
      }
      else if (!token && callbackTokenRef.current === null && effectivePath === '/login') {
        const useLocalLogin = new URL(window.location.href).searchParams.get('local') === '1';
        if (!useLocalLogin) {
        // Use the originally-intended URL saved by RequireAuth BEFORE it navigated to /login
        const storedRedirect = sessionStorage.getItem('auth_redirect_from');
        const target = storedRedirect
          ? encodeURIComponent(storedRedirect)
          : encodeURIComponent(window.location.origin + '/');
        window.location.href = 'https://auth.meijian.top?redirect=' + target;
        }
      }
      else {
      }
    }
  }, [token, loading]);

  if (loading) return <div className="loading">加载中...</div>;

  if (page === '/login') return <Login onLogin={handleLogin} />;
  if (page === '/set-password') return <SetPassword onSet={() => handleLogin('/home')} />;
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


