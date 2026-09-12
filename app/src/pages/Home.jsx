import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { BASE, pointsApi, inviteApi } from '../api.js';
import { composeShareCard, shareImage } from '../utils/makeShareCard.js';

const PRODUCTS = [
  { id: 'ai-beauty', label: 'AI 美妆', icon: '💄' },
  { id: 'chat-ai', label: '聊天AI', icon: '💬', path: 'https://gxvipvpn2.ccwu.cc' },
];

const COMING_SOON = { id: 'coming-soon', label: '更多功能开发中...', icon: '+' };

function navigate(path) {
  if (path.startsWith('http')) {
    window.open(path, '_blank');
    return;
  }
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
  const [pointsBalance, setPointsBalance] = useState(null);
  const [inviteCode, setInviteCode] = useState(null);
  const [invitedCount, setInvitedCount] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareDone, setShareDone] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(BASE + '/config/feature_request_message').then(r => r.ok ? r.json().then(d => d.value ?? '') : Promise.resolve('')),
      fetch(BASE + '/config/feature_request_contact').then(r => r.ok ? r.json().then(d => d.value ?? '') : Promise.resolve('')),
    ]).then(([msg, contactRaw]) => {
      setFeatureMsg(msg || '有什么需要的功能欢迎投稿～');
      setContactList(parseContactList(contactRaw));
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    pointsApi.getBalance().then((val) => {
      if (!cancelled) setPointsBalance(val);
    }).catch(() => {
      if (!cancelled) setPointsBalance(null);
    });
    return () => { cancelled = true; };
  }, [token]);

  // 邀请码 + 已邀请人数
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    inviteApi.getMine().then((data) => {
      if (cancelled) return;
      setInviteCode(data.inviteCode || null);
      setInvitedCount(data.invitedCount ?? 0);
    }).catch(() => {
      if (!cancelled) { setInviteCode(null); setInvitedCount(null); }
    });
    return () => { cancelled = true; };
  }, [token]);

  // 复制邀请码
  const handleCopyInvite = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = inviteCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1500);
    }
  };

  // 生成分享图（本地 canvas 合成）
  const handleGenerateShareImage = async () => {
    if (shareLoading || !inviteCode) return;
    setShareLoading(true);
    setShareDone(false);
    try {
      const blob = await composeShareCard(inviteCode);
      await shareImage(blob);
      setShareDone(true);
    } catch (err) {
      console.error('[Home] 生成分享图异常:', err);
    } finally {
      setShareLoading(false);
    }
  };

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

  const handleAiBeautyClick = () => {
    const id = sessionStorage.getItem('capture_report_id');
    if (id) {
      navigate('/report?id=' + encodeURIComponent(id));
    } else {
      navigate('/report');
    }
  };

  return (
    <div className="home-page">
      {/* 邀请码卡片 */}
      {inviteCode && (
        <div className="home-invite-card">
          <div className="home-invite-header">
            <span className="home-invite-title">🎁 邀请好友</span>
            <span className="home-invite-count">已成功邀请 {invitedCount ?? 0} 人</span>
          </div>
          {pointsBalance !== null && (
            <div className="home-points-inline">
              <span>积分：{pointsBalance}分</span>
            </div>
          )}
          <div className="home-invite-code-row">
            <code className="home-invite-code">{inviteCode}</code>
            <button className="home-invite-copy-btn" onClick={handleCopyInvite}>
              {inviteCopied ? '已复制 ✓' : '复制'}
            </button>
          </div>
          <button
            className={"home-invite-share-btn" + (shareLoading ? " home-invite-share-btn--loading" : "")}
            onClick={handleGenerateShareImage}
            disabled={shareLoading}
          >
            {shareLoading ? '生成中…' : shareDone ? '✓ 已分享' : '生成分享图'}
          </button>
        </div>
      )}

      <div className="home-product-grid">
        {PRODUCTS.map((p) => (
          <button
            key={p.id}
            className="home-product-card"
            onClick={p.id === 'ai-beauty' ? handleAiBeautyClick : () => navigate(p.path)}
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
