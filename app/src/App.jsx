import { useState, useEffect, useContext, useRef } from 'react';
import { AuthContext, AuthProvider, setOnTokenInvalid } from './context/AuthContext.jsx';
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

// 跳中枢登录（保留当前完整 URL 作为 redirect，登录完回跳）。
// local=1 时走本地登录表单（调试用），不跳中枢。
export function redirectToAuthCenter() {
  const useLocalLogin = new URL(window.location.href).searchParams.get('local') === '1';
  if (useLocalLogin) return;
  const target = encodeURIComponent(window.location.href);
  window.location.href = 'https://auth.meijian.top?redirect=' + target;
}

function Router() {
  const { token, loading, validating, logout, login } = useContext(AuthContext);
  const [page, setPage] = useState(() => {
    const saved = sessionStorage.getItem('auth_redirect_from');
    const path = window.location.pathname;
    return saved || (path === '/' ? '' : path) || '/home';
  });
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path !== page) setPage(path === '' ? '/home' : path);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [page]);

  // 中枢登录成功后 302 回本端（带 ?token= 或 ?redirect=）：清掉 query，以 cookie 重新判定
  const handledCallbackRef = useRef(false);
  useEffect(() => {
    if (handledCallbackRef.current) return;
    const u = new URL(window.location.href);
    const hasToken = u.searchParams.has('token');
    const hasRedirect = u.searchParams.has('redirect');
    const invite = u.searchParams.get('invite');
    if (hasToken || hasRedirect || invite) {
      handledCallbackRef.current = true;
      if (invite) sessionStorage.setItem('invite_code', invite);
      const clean = new URL(window.location.href);
      clean.search = '';
      window.history.replaceState(null, '', clean.pathname + clean.hash);
      login(); // 重新探测 cookie 登录态
    }
  }, [login]);

  const handleLogout = async () => {
    await logout();
    sessionStorage.removeItem('auth_redirect_from');
    const target = '/home';
    setPage(target);
    window.history.replaceState(null, '', target);
  };

  // 无有效 cookie 登录态：跳中枢登录（?redirect= 当前页）
  // 仅在 validating 完成（cookie 探测结束）且确认无登录态时才跳，避免启动瞬间误跳
  useEffect(() => {
    if (loading || validating) return;
    if (token) return; // cookie 里有有效登录态
    const path = window.location.pathname;
    const effectivePath = path === '/' ? '' : path;
    if (new URL(window.location.href).searchParams.get('local') === '1') return; // 本地调试
    if (effectivePath.startsWith('/admin')) return; // 管理后台独立鉴权
    if (effectivePath === '/login') return;
    sessionStorage.setItem('auth_redirect_from', window.location.href);
    redirectToAuthCenter();
  }, [token, loading, validating]);

  // 有登录态且落在根路径 → 归一到 /home
  useEffect(() => {
    if (!token || loading) return;
    const path = window.location.pathname;
    if (path === '/' || path === '') {
      setPage('/home');
      window.history.replaceState(null, '', '/home');
    }
  }, [token, loading]);

  if (loading) return <div className="loading">加载中...</div>;

  if (page === '/admin/login') return <AdminLogin />;
  if (page === '/admin/dashboard') return <AdminRequireAuth><AdminDashboard /></AdminRequireAuth>;

  // /login 仅作为本地调试（?local=1）入口保留；正常流程会被跳中枢
  const renderPage = () => (
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

  return renderPage();
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
