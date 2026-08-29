import { useState, useEffect } from 'react';
import { getStorageItem, STORAGE_KEYS } from '../utils/storage.js';

export default function AdminRequireAuth({ children }) {
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    void (async () => {
      const token = await getStorageItem(STORAGE_KEYS.ADMIN_SESSION_TOKEN);
      if (!token) {
        window.history.replaceState(null, '', '/admin/login');
        window.location.href = '/admin/login';
      } else {
        setAuthChecked(true);
      }
    })();
  }, []);

  if (!authChecked) {
    return <div className="loading">加载中...</div>;
  }

  return children;
}