import { useState, useEffect } from 'react';
import { adminApi } from '../api.js';

const CONFIG_DEFS = [
  { key: 'feature_request_message', label: '功能建议消息', desc: '用户提交功能建议后的提示语' },
  { key: 'feature_request_contact', label: '功能建议联系方式', desc: '用户提交功能建议后的联系方式' },
  { key: 'influencer_apply_message', label: '达人申请成功消息', desc: '达人申请提交成功后的提示语' },
  { key: 'influencer_contact_info', label: '达人联系方式', desc: '后台显示的达人联系信息' },
  { key: 'tier3_preview_text', label: 'Tier3 预览文案', desc: '第三层报告预览显示的文字' },
  { key: 'tier3_token_price', label: 'Tier3 积分价格', desc: '解锁 Tier3 需要的积分（单位：分）' },
];

const CONTACT_KEYS = ['influencer_contact_info', 'feature_request_contact'];

function parseContactRows(raw) {
  if (!raw) return [{ platform: '', account: '' }];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(r => r.platform || r.account).map(r => ({ platform: r.platform || '', account: r.account || '' }));
    }
    if (parsed.platform !== undefined) {
      return [{ platform: parsed.platform || '', account: parsed.account || '' }];
    }
    return [{ platform: '', account: raw }];
  } catch {
    return [{ platform: '', account: raw }];
  }
}

export default function AdminConfig() {
  const [configs, setConfigs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [rows, setRows] = useState([{ platform: '', account: '' }]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  useEffect(() => {
    adminApi.getConfig().then(data => setConfigs(data.configs || [])).catch(err => showToast(err.message));
  }, []);

  const handleEdit = (cfg) => {
    setEditing(cfg.key);
    let val = cfg.value || '';
    if (cfg.key === 'tier3_token_price' && val) {
      val = (parseInt(val, 10) / 100).toFixed(2);
    }
    setEditValue(val);
    if (CONTACT_KEYS.includes(cfg.key)) {
      setRows(parseContactRows(val));
    } else {
      setRows([{ platform: '', account: '' }]);
    }
  };

  const handleRowChange = (idx, field, val) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const handleAddRow = () => setRows(prev => [...prev, { platform: '', account: '' }]);

  const handleRemoveRow = (idx) => {
    setRows(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev.map(r => ({ ...r, platform: '', account: '' })));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let saveVal;
      if (CONTACT_KEYS.includes(editing)) {
        const filtered = rows.filter(r => r.platform.trim() || r.account.trim());
        saveVal = JSON.stringify(filtered.map(r => ({ platform: r.platform.trim(), account: r.account.trim() })));
      } else if (editing === 'tier3_token_price') {
        saveVal = String(Math.round(parseFloat(editValue) * 100));
      } else {
        saveVal = editValue;
      }
      await adminApi.saveConfig(editing, saveVal);
      setEditing(null);
      setConfigs(prev => prev.map(c => c.key === editing ? { ...c, value: saveVal } : c));
      showToast('已保存');
    } catch (err) {
      showToast(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-config-list">
      {CONFIG_DEFS.map(def => {
        const cfg = configs.find(c => c.key === def.key);
        const isEditing = editing === def.key;
        const isPrice = def.key === 'tier3_token_price';
        const isContact = CONTACT_KEYS.includes(def.key);
        return (
          <div key={def.key} className="admin-config-item">
            <div className="admin-config-label-row">
              <span className="admin-config-label">{def.label}</span>
              <span className="admin-config-key">{def.key}</span>
            </div>
            <p className="admin-config-desc">{def.desc}</p>
            <div className="admin-config-input-row">
              {isEditing ? (
                <>
                  {isContact ? (
                    <div className="admin-contact-array">
                      {rows.map((row, idx) => (
                        <div key={idx} className="admin-contact-row">
                          <input
                            className="admin-contact-platform"
                            type="text"
                            placeholder="平台名称"
                            value={row.platform}
                            onChange={(e) => handleRowChange(idx, 'platform', e.target.value)}
                          />
                          <input
                            className="admin-contact-account"
                            type="text"
                            placeholder="账号"
                            value={row.account}
                            onChange={(e) => handleRowChange(idx, 'account', e.target.value)}
                          />
                          <button className="admin-contact-del" onClick={() => handleRemoveRow(idx)} title="删除">✕</button>
                        </div>
                      ))}
                      <button className="admin-contact-add" onClick={handleAddRow}>+ 添加一条</button>
                    </div>
                  ) : (
                    <>
                      <input
                        className="admin-config-input"
                        type={isPrice ? 'number' : 'text'}
                        step={isPrice ? '0.01' : undefined}
                        min={isPrice ? '0' : undefined}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(null); }}
                        autoFocus
                      />
                      {isPrice && <span className="admin-config-unit">元（存为分）</span>}
                    </>
                  )}
                  <button className="admin-btn-save" onClick={handleSave} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button className="admin-btn-cancel" onClick={() => setEditing(null)}>取消</button>
                </>
              ) : (
                <>
                  <span style={{ fontSize: '14px', color: '#374151', flex: 1, wordBreak: 'break-all' }}>
                    {cfg?.value
                      ? (() => {
                          try {
                            const parsed = JSON.parse(cfg.value);
                            if (Array.isArray(parsed) && parsed.length) {
                              return parsed.map(r => `${r.platform}：${r.account}`).join('、');
                            }
                            if (parsed?.platform) return `${parsed.platform}：${parsed.account || ''}`;
                            return cfg.value;
                          } catch { return cfg.value; }
                        })()
                      : '(未设置)'
                    }
                  </span>
                  <button className="admin-btn-save" onClick={() => handleEdit(cfg)}>编辑</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}
