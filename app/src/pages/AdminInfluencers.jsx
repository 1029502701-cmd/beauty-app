import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api.js';

const STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
];

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminInfluencers() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [openPreviewPhoto, setOpenPreviewPhoto] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getInfluencers(filter);
      setList(data.list || []);
    } catch (err) {
      showToast(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadList(); }, [loadList]);

  const handleApprove = async (id) => {
    try {
      await adminApi.approveInfluencer(id);
      showToast('已通过');
      setList(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      showToast(err.message || '操作失败');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { showToast('请填写拒绝原因'); return; }
    setSaving(true);
    try {
      await adminApi.rejectInfluencer(rejectId, rejectReason.trim());
      showToast('已拒绝');
      setList(prev => prev.filter(i => i.id !== rejectId));
      setRejectId(null);
      setRejectReason('');
    } catch (err) {
      showToast(err.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (s) => {
    if (s === 'pending') return { bg: '#fef3c7', color: '#92400e' };
    if (s === 'approved') return { bg: '#d1fae5', color: '#065f46' };
    if (s === 'rejected') return { bg: '#fee2e2', color: '#991b1b' };
    return { bg: '#f3f4f6', color: '#6b7280' };
  };

  return (
    <div>
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <select
          className="admin-config-input"
          style={{ height: '36px', width: 'auto', flex: 'none', padding: '0 8px' }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {loading && <span style={{ fontSize: '13px', color: '#6b7280' }}>加载中...</span>}
      </div>

      {list.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>暂无数据</div>
      )}

      <div className="admin-influencer-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
        {list.map(item => (
          <div key={item.id} className="admin-influencer-card" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', gap: '14px' }}>
            {/* 左侧：妆容照 */}
            {item.makeup_photo_url && (
              <div style={{ flexShrink: 0, width: '80px' }}>
                <div style={{ width: '80px', aspectRatio: '3/4', borderRadius: '8px', overflow: 'hidden', cursor: 'zoom-in' }} onClick={() => setOpenPreviewPhoto(item.makeup_photo_url)}>
                  <img src={item.makeup_photo_url} alt="妆容照" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>
            )}
            {/* 右侧：信息 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* 昵称 + 状态 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>{item.nickname || '未知昵称'}</span>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: getStatusColor(item.status)?.bg, color: getStatusColor(item.status)?.color, flexShrink: 0 }}>
                  {item.status}
                </span>
              </div>
              {/* 个人简介 */}
              {item.bio && <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 6px', lineHeight: '1.5' }}>{item.bio}</p>}
              {/* 用户自选：擅长妆容 */}
              {item.styles && item.styles.length > 0 && (
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: '6px' }}>擅长妆容：</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {item.styles.map((tag, idx) => (
                      <span key={idx} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' }}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* AI分析：风格标签 */}
              {item.persona_tags && item.persona_tags.length > 0 && (
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#9ca3af', marginRight: '6px' }}>AI风格：</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {item.persona_tags.map((tag, idx) => (
                      <span key={idx} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* 平台链接 */}
              {item.link1 && (
                <p style={{ fontSize: '12px', margin: '0 0 3px' }}>
                  <a href={item.link1} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'none' }}>
                    {item.platform || '主页链接'}: {item.link1.length > 40 ? item.link1.slice(0, 40) + '...' : item.link1}
                  </a>
                </p>
              )}
              {item.link2 && (
                <p style={{ fontSize: '12px', margin: '0 0 3px' }}>
                  <a href={item.link2} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'none' }}>
                    备用链接: {item.link2.length > 40 ? item.link2.slice(0, 40) + '...' : item.link2}
                  </a>
                </p>
              )}
              {/* 拒绝原因 */}
              {item.status === 'rejected' && item.reject_reason && (
                <p style={{ fontSize: '12px', color: '#991b1b', margin: '4px 0 6px', background: '#fef2f2', padding: '4px 8px', borderRadius: '4px' }}>
                  拒绝原因: {item.reject_reason}
                </p>
              )}
              {/* 提交时间 */}
              <div className="admin-time" style={{ fontSize: '11px', color: '#9ca3af' }}>提交于 {formatTime(item.created_at)}</div>
              {/* 操作按钮 */}
              {filter === 'pending' && (
                <div className="admin-influencer-actions" style={{ marginTop: '8px' }}>
                  <button className="admin-btn-approve" onClick={() => handleApprove(item.id)}>通过</button>
                  <button className="admin-btn-reject" onClick={() => { setRejectId(item.id); setRejectReason(''); }}>拒绝</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {openPreviewPhoto && (
        <div className="photo-lightbox-overlay" onClick={() => setOpenPreviewPhoto(null)}>
          <img className="photo-lightbox-img" src={openPreviewPhoto} alt="妆容照放大" />
        </div>
      )}

      {rejectId && (
        <div className="admin-modal-overlay" onClick={() => setRejectId(null)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <h3>拒绝达人申请</h3>
            <p className="admin-modal-hint">请输入拒绝原因</p>
            <textarea
              className="admin-textarea"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请输入拒绝原因..."
            />
            <div className="admin-modal-actions">
              <button className="admin-btn-cancel" onClick={() => setRejectId(null)}>取消</button>
              <button className="admin-btn-confirm" onClick={handleReject} disabled={saving || !rejectReason.trim()}>
                {saving ? '提交中...' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}
