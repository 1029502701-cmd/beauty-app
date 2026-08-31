import os
os.chdir(r'C:\Users\yao\Documents\ChatGPT\美妆app')
path = 'app/src/App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Replace unauthenticated redirect
old_r = """      // Unauthenticated: redirect to /login (also normalize / -> /login)
      if (!token && effectivePath !== '/login' && effectivePath !== '/admin/login' && !effectivePath.startsWith('/admin')) {
        sessionStorage.setItem('auth_redirect_from', effectivePath || '/');
        setPage('/login');
        window.history.replaceState(null, '', '/login');
      }"""
new_r = """      // Unauthenticated: redirect to unified login (auth.meijian.top)
      if (!token && effectivePath !== '/login' && effectivePath !== '/admin/login' && !effectivePath.startsWith('/admin')) {
        const target = encodeURIComponent(window.location.origin + effectivePath || '/');
        window.location.href = 'https://auth.meijian.top?redirect=' + target;
      }"""
c = c.replace(old_r, new_r)

# 2. Remove Login page rendering
old_login = "    if (page === '/login') return <Login onLogin={handleLogin} />;"
c = c.replace(old_login, "    // Login page removed from routing — external auth via auth.meijian.top")

# 3. Add token-from-url handler before the main useEffect
old_main = """  useEffect(() => {
    if (!loading) {
      const path = window.location.pathname;
      const effectivePath = path === '/' ? '' : path;
      // Unauthenticated"""
new_main = """  // Handle token returned from auth.meijian.top
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
      // Unauthenticated"""
c = c.replace(old_main, new_main)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

ok = 'auth.meijian.top' in c and 'tokenProcessRef' in c and 'Login onLogin' not in c
print('App.jsx updated OK:', ok)
