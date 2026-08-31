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
  const { token, loading, logout } = useContext(AuthContext);
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
    loginRedirectTargetRef.current = null;
    setPage('/login');
    window.history.replaceState(null, '', '/login');
  };

  // Handle token returned from auth.meijian.top
  const tokenProcessRef = useRef(false);
  useEffect(() => {
    if (tokenProcessRef.current || loading) return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    if (token) {
      tokenProcessRef.current = true;
      url.searchParams.delete('token');
      window.history.replaceState(null, '', url.toString());
      login(token);
      const redirectFrom = url.searchParams.get('redirect');
      const target = redirectFrom ? decodeURIComponent(redirectFrom) : '/home';
      setPage(target === '/home' ? '' : target);
      window.history.replaceState(null, '', target === '/home' ? '/' : target);
    }
  }, [loading, login]);

  useEffect(() => {
    if (!loading) {
      const path = window.location.pathname;
      const effectivePath = path === '/' ? '' : path;
      // Unauthenticated: redirect to unified login (auth.meijian.top)
      if (!token && effectivePath !== '/login' && effectivePath !== '/admin/login' && !effectivePath.startsWith('/admin')) {
        const target = encodeURIComponent(window.location.origin + effectivePath || '/');
        window.location.href = 'https://auth.meijian.top?redirect=' + target;
      }
      // Authenticated: redirect root / to /home
      else if (token && (effectivePath === '' || effectivePath === '/')) {
        setPage('/home');
        window.history.replaceState(null, '', '/home');
      }
      else if (token && effectivePath !== '/login' && effectivePath !== page && !loginRedirectTargetRef.current) {
        // Sync URL on direct navigation while authenticated (e.g. refresh)
        setPage(effectivePath);
      }
      else if (!token && effectivePath === '/login' && page !== '/login') {
        setPage('/login');
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
