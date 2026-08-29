import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { BASE } from '../api.js';

const STATUS_MAP = {
  pending:   { label: '待审核',   color: '#d97706', bg: '#fffbeb',    border: '#fcd34d' },
  approved:  { label: '已通过',   color: '#059669', bg: '#ecfdf5',    border: '#6ee7b7' },
  rejected:  { label: '已拒绝',   color: '#dc2626', bg: '#fef2f2',    border: '#fca5a5' },
};

function PhotoUpload({ label, hint, value, onChange, onView }) {
  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => onChange(ev.target.result);
      reader.readAsDataURL(file);
    };
    input.click();
  };
  return (
    <div className="ia-upload">
      <label className="ia-upload-label">{label}</label>
      <p className="ia-upload-hint">{hint}</p>
      <button className="ia-upload-btn" type="button" onClick={handleClick}>
        {value ? '重新上传' : '上传图片'}
      </button>
      {value && (
        <img
          className="ia-upload-preview"
          src={value}
          alt={label}
          onClick={() => onView?.(value)}
        />
      )}
    </div>
  );
}

function StyleTags({ selected, onChange }) {
  const all = ['日常妆', '浓妆', '清新妆', '烟熏妆', '韩系妆', '欧美妆'];
  const toggle = (s) => {
    const next = selected.includes(s) ? selected.filter(x => x !== s) : [...selected, s];
    onChange(next);
  };
  return (
    <div className="ia-tags">
      {all.map(s => (
        <button key={s} className={['ia-tag', selected.includes(s) && 'ia-tag--active'].filter(Boolean).join(' ')} type="button" onClick={() => toggle(s)}>
          {s}
        </button>
      ))}
    </div>
  );
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

export default function InfluencerApply() {
  const { token } = useContext(AuthContext);
  const [barePhoto, setBarePhoto] = useState(null);
  const [makeupPhoto, setMakeupPhoto] = useState(null);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [styles, setStyles] = useState([]);
  const [platformLink, setPlatformLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMsg, setModalMsg] = useState('');
  const [contactList, setContactList] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [openPhoto, setOpenPhoto] = useState(null);

  const fetchMyStatus = useCallback(async () => {
    setShowStatusModal(true);
    setStatusLoading(true);
    try {
      const res = await fetch(BASE + '/influencers/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      setStatusData(data);
    } catch (err) {
      setStatusData({ error: err.message || '加载失败' });
    } finally {
      setStatusLoading(false);
    }
  }, [token]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!barePhoto) { setErrorMsg('请上传素颜照'); return; }
    if (!makeupPhoto) { setErrorMsg('请上传妆容照'); return; }
    if (!nickname.trim()) { setErrorMsg('请填写平台昵称'); return; }
    setSubmitting(true);
    try {
      const form = new FormData();
      const dataUrlToFile = (dataUrl, name) => {
        const byteStr = atob(dataUrl.split(',')[1]);
        const arr = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
        return new Blob([arr], { type: 'image/jpeg' });
      };
      form.append('bare_photo', dataUrlToFile(barePhoto, 'bare.jpg'), 'bare.jpg');
      form.append('makeup_photo', dataUrlToFile(makeupPhoto, 'makeup.jpg'), 'makeup.jpg');
      form.append('nickname', nickname.trim());
      if (bio.trim()) form.append('bio', bio.trim());
      if (styles.length) form.append('styles', JSON.stringify(styles));
      if (platformLink.trim()) form.append('platform_link', platformLink.trim());
      const res = await fetch(BASE + '/influencers/apply', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '提交失败');
      setContactList(parseContactList(data.contact));
      setModalMsg(data.message || '申请已提交，我们会尽快联系你～');
      setShowModal(true);
    } catch (err) {
      setErrorMsg(err.message || '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }, [barePhoto, makeupPhoto, nickname, bio, styles, platformLink, token]);

  const handleCopy = (account, idx) => {
    const ta = document.createElement('textarea');
    ta.value = account;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="ia-page">
      <div className="ia-header">
        <button className="ia-back" onClick={() => history.back()}>‹ 返回</button>
        <span className="ia-title">达人入驻申请</span>
        <button className="ia-my-status-btn" onClick={fetchMyStatus}>我的申请</button>
      </div>

      <form className="ia-form" onSubmit={handleSubmit}>
        <PhotoUpload label="素颜照" hint="请上传正面清晰素颜照，用于面部特征分析" value={barePhoto} onChange={setBarePhoto} onView={setOpenPhoto} />
        <PhotoUpload label="妆容照" hint="请上传一张你满意的妆容照片" value={makeupPhoto} onChange={setMakeupPhoto} onView={setOpenPhoto} />
        <div className="ia-field">
          <label className="ia-label">平台昵称 <span className="ia-required">*</span></label>
          <input className="ia-input" type="text" placeholder="请输入你的平台昵称" value={nickname} onChange={e => setNickname(e.target.value)} maxLength={30} />
        </div>
        <div className="ia-field">
          <label className="ia-label">个人简介</label>
          <textarea className="ia-textarea" placeholder="简单介绍一下自己吧～（选填）" value={bio} onChange={e => setBio(e.target.value)} rows={3} maxLength={200} />
        </div>
        <div className="ia-field">
          <label className="ia-label">擅长妆容</label>
          <StyleTags selected={styles} onChange={setStyles} />
        </div>
        <div className="ia-field">
          <label className="ia-label">平台主页链接</label>
          <input className="ia-input" type="url" placeholder="如小红书/抖音主页链接（选填）" value={platformLink} onChange={e => setPlatformLink(e.target.value)} />
        </div>
        {errorMsg && <p className="ia-error">{errorMsg}</p>}
        <button className="ia-submit-btn" type="submit" disabled={submitting}>
          {submitting ? '提交中...' : '提交申请'}
        </button>
      </form>

      {openPhoto && (
        <div className="photo-lightbox-overlay" onClick={() => setOpenPhoto(null)}>
          <img className="photo-lightbox-img" src={openPhoto} alt="预览" />
        </div>
      )}

      {showModal && (
        <div className="ia-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ia-modal" onClick={e => e.stopPropagation()}>
            <div className="ia-modal-icon">✓</div>
            <h2 className="ia-modal-title">申请已提交</h2>
            <p className="ia-modal-msg">{modalMsg || '申请已提交，我们会尽快联系你～'}</p>
            {contactList.length > 0 && (
              <div className="ia-modal-contact">
                <p className="ia-modal-contact-label">请联系工作人员</p>
                {contactList.map((item, idx) => (
                  <div key={idx} className="ia-modal-contact-row">
                    <code className="ia-modal-contact-code">{item.platform}{item.account ? `：${item.account}` : ''}</code>
                    <button className="ia-modal-copy-btn" onClick={() => handleCopy(item.account, idx)}>
                      {copiedIdx === idx ? '已复制' : '复制'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button className="ia-modal-ok-btn" onClick={() => { setShowModal(false); window.location.href = '/influencer-apply'; }}>我知道了</button>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="ia-modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="ia-modal" onClick={e => e.stopPropagation()}>
            <div className="ia-modal-icon">📋</div>
            <h2 className="ia-modal-title">我的申请</h2>
            {statusLoading ? (
              <p className="ia-modal-msg">加载中…</p>
            ) : statusData?.error ? (
              <p className="ia-modal-msg" style={{ color: '#ef4444' }}>{statusData.error}</p>
            ) : !statusData?.exists ? (
              <p className="ia-modal-msg">还没有申请记录</p>
            ) : (
              <>
                <div className="ia-status-badge" style={{
                  color: STATUS_MAP[statusData.status]?.color || '#6b7280',
                  background: STATUS_MAP[statusData.status]?.bg || '#f9fafb',
                  borderColor: STATUS_MAP[statusData.status]?.border || '#e5e7eb',
                }}>{STATUS_MAP[statusData.status]?.label || statusData.status}</div>
                <p className="ia-modal-msg">提交时间：{formatTime(statusData.submittedAt)}</p>
                {statusData.status === 'rejected' && statusData.rejectReason && (
                  <p className="ia-reject-reason">拒绝原因：{statusData.rejectReason}</p>
                )}
              </>
            )}
            <button className="ia-modal-ok-btn" onClick={() => setShowStatusModal(false)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}