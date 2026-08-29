import { useState, useEffect, useContext } from 'react';
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
    return saved || window.location.pathname || '/home';
  });
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path !== page) setPage(path === '' ? '/home' : path);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [page]);

  const handleLogin = (redirectFrom) => {
    sessionStorage.removeItem('auth_redirect_from');
    const target = redirectFrom || '/home';
    setPage(target);
    window.history.replaceState(null, '', target);
  };

  const handleLogout = async () => {
    await logout();
    sessionStorage.removeItem('auth_redirect_from');
    setPage('/login');
    window.history.replaceState(null, '', '/login');
  };

  useEffect(() => {
    if (!loading) {
      const path = window.location.pathname;
      if (token && path === '/login') {
        const from = sessionStorage.getItem('auth_redirect_from') || '/home';
        sessionStorage.removeItem('auth_redirect_from');
        setPage(from);
        window.history.replaceState(null, '', from);
      } else if (!token && path !== '/login' && path !== '/admin/login' && !path.startsWith('/admin')) {
        sessionStorage.setItem('auth_redirect_from', path);
        setPage('/login');
        window.history.replaceState(null, '', '/login');
      } else if (token && path !== '/login' && path !== page) {
        setPage(path);
      } else if (!token && path === '/login' && page !== '/login') {
        setPage('/login');
      }
    }
  }, [token, loading]);

  if (loading) return <div className="loading">加载中...</div>;

  if (page === '/admin/login') return <AdminLogin />;
  if (page === '/admin/dashboard') return <AdminRequireAuth><AdminDashboard /></AdminRequireAuth>;

  const renderPage = () => {
    if (page === '/login') return <Login onLogin={handleLogin} />;
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
