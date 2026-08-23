import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { BASE } from '../api.js';

const PRODUCTS = [
  { id: 'ai-beauty', label: 'AI 美妆', icon: '💄', path: '/capture' },
];

const COMING_SOON = { id: 'coming-soon', label: '更多功能开发中...', icon: '+' };

function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// Returns an array of {platform, account} from raw config value, with backward compat
function parseContactList(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(r => r.platform || r.account).map(r => ({ platform: r.platform || '', account: r.account || '' }));
    if (parsed.platform !== undefined) return [{ platform: parsed.platform || '', account: parsed.account || '' }];
    return [{ platform: '', account: value }];
  } catch {
    return [{ platform: '', account: value }];
  }
}

export default function Home({ onLogout }) {
  const { token } = useContext(AuthContext);
  const [featureMsg, setFeatureMsg] = useState('有什么需要的功能欢迎投稿～');
  const [contactList, setContactList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(BASE + '/config/feature_request_message').then(r => r.ok ? r.json().then(d => d.value ?? '') : Promise.resolve('')),
      fetch(BASE + '/config/feature_request_contact').then(r => r.ok ? r.json().then(d => d.value ?? '') : Promise.resolve('')),
    ]).then(([msg, contactRaw]) => {
      setFeatureMsg(msg || '有什么需要的功能欢迎投稿～');
      setContactList(parseContactList(contactRaw));
    });
  }, []);

  const handleCopy = async (account) => {
    if (!account) return;
    try {
      await navigator.clipboard.writeText(account);
      setCopiedIdx(0);
      setTimeout(() => setCopiedIdx(null), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = account;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedIdx(0);
      setTimeout(() => setCopiedIdx(null), 1500);
    }
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-avatar" />
        <span className="home-greeting">你好</span>
      </div>

      <div className="home-product-grid">
        {PRODUCTS.map((p) => (
          <button
            key={p.id}
            className="home-product-card"
            onClick={() => navigate(p.path)}
          >
            <span className="home-product-icon">{p.icon}</span>
            <span className="home-product-label">{p.label}</span>
          </button>
        ))}
        <button
          key={COMING_SOON.id}
          className="home-product-card home-product-card--disabled home-product-card--clickable"
          onClick={() => setShowModal(true)}
        >
          <span className="home-product-icon">{COMING_SOON.icon}</span>
          <span className="home-product-label">{COMING_SOON.label}</span>
        </button>
      </div>

      <button className="logout-btn" onClick={onLogout}>退出登录</button>

      {showModal && (
        <div className="ia-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ia-modal" onClick={e => e.stopPropagation()}>
            <div className="ia-modal-icon">+</div>
            <h2 className="ia-modal-title">功能需求反馈</h2>
            <p className="ia-modal-msg">{featureMsg}</p>
            {contactList.length > 0 && (
              <div className="ia-modal-contact">
                <p className="ia-modal-contact-label">请联系工作人员</p>
                {contactList.map((item, idx) => (
                  <div key={idx} className="ia-modal-contact-row">
                    <code className="ia-modal-contact-code">{item.platform}{item.account ? `：${item.account}` : ''}</code>
                    <button className="ia-modal-copy-btn" onClick={() => handleCopy(item.account)}>
                      {copiedIdx === idx ? '已复制' : '复制'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="ia-modal-ok-btn" onClick={() => setShowModal(false)}>我知道了</button>
          </div>
        </div>
      )}
    </div>
  );
}
