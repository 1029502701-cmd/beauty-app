import { useState } from 'react';
import { adminApi } from '../api.js';
import AdminInfluencers from './AdminInfluencers.jsx';
import AdminConfig from './AdminConfig.jsx';
import AdminQuestionnaire from './AdminQuestionnaire.jsx';

const MENU_ITEMS = [
  { key: 'influencers', label: '达人审核', icon: '👤' },
  { key: 'config', label: '文案配置', icon: '📝' },
  { key: 'questionnaire', label: '问卷选项', icon: '📋' },
  { key: 'weights', label: '权重管理', icon: '⚖️', placeholder: true },
  { key: 'products', label: '商品管理', icon: '🛒', placeholder: true },
];

export default function AdminDashboard() {
  const [active, setActive] = useState('influencers');

  const handleLogout = () => {
    adminApi.logout();
    window.history.replaceState(null, '', '/admin/login');
    window.location.href = '/admin/login';
  };

  const renderContent = () => {
    if (active === 'influencers') return <AdminInfluencers />;
    if (active === 'config') return <AdminConfig />;
    if (active === 'questionnaire') return <AdminQuestionnaire />;
    if (active === 'weights' || active === 'products') {
      return (
        <div className="admin-placeholder">
          <div className="admin-placeholder-icon">{MENU_ITEMS.find(m => m.key === active)?.icon}</div>
          <h2>开发中</h2>
          <p>该模块正在建设中，敬请期待</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="admin-sidebar-logo">💄</span>
          <span className="admin-sidebar-title">管理后台</span>
        </div>
        <nav className="admin-nav">
          {MENU_ITEMS.map(item => (
            <button
              key={item.key}
              className={'admin-nav-item' + (active === item.key ? ' admin-nav-item--active' : '')}
              onClick={() => !item.placeholder && setActive(item.key)}
              disabled={item.placeholder}
            >
              <span>{item.icon} {item.label}</span>
              {item.placeholder && <span className="admin-nav-badge">开发中</span>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-logout-btn" onClick={handleLogout}>退出登录</button>
        </div>
      </aside>
      <main className="admin-main">
        <div className="admin-topbar">
          <h1 className="admin-page-title">
            {MENU_ITEMS.find(m => m.key === active)?.icon} {MENU_ITEMS.find(m => m.key === active)?.label}
          </h1>
        </div>
        <div className="admin-content">{renderContent()}</div>
      </main>
    </div>
  );
}
