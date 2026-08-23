import { useEffect } from 'react';

const ADMIN_TOKEN_KEY = 'admin_session_token';

export default function AdminRequireAuth({ children }) {
  useEffect(() => {
    if (!localStorage.getItem(ADMIN_TOKEN_KEY)) {
      window.history.replaceState(null, '', '/admin/login');
      window.location.href = '/admin/login';
    }
  }, []);

  return children;
}
