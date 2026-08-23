import { useState, useEffect } from 'react';
import { adminApi } from '../api.js';

const DIMENSIONS = [
  { key: 'makeupStyle', label: '妆容风格', desc: '用户偏好的妆容风格选项' },
  { key: 'scenario', label: '使用场景', desc: '适用场景选项' },
  { key: 'skillLevel', label: '化妆水平', desc: '用户化妆技能水平选项' },
  { key: 'timeCost', label: '时间成本', desc: '愿意花费的时间选项' },
];

export default function AdminQuestionnaire() {
  const [data, setData] = useState([]);
  const [editingDim, setEditingDim] = useState(null);
  const [editOptions, setEditOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  useEffect(() => {
    adminApi.getQuestionnaireOptions().then(res => setData(res.options || [])).catch(err => showToast(err.message));
  }, []);

  const startEdit = (dim) => {
    setEditingDim(dim.key);
    const existing = data.find(d => d.dimension === dim.key);
    setEditOptions(existing ? [...existing.options] : []);
  };

  const addOption = () => {
    setEditOptions(prev => [...prev, '']);
  };

  const updateOption = (index, value) => {
    setEditOptions(prev => prev.map((opt, i) => i === index ? value : opt));
  };

  const removeOption = (index) => {
    setEditOptions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (dim) => {
    const filtered = editOptions.filter(o => o.trim());
    if (filtered.length === 0) { showToast('请至少保留一个选项'); return; }
    setSaving(true);
    try {
      await adminApi.saveQuestionnaireOption(dim.key, filtered);
      setData(prev => prev.map(d => d.dimension === dim.key ? { ...d, options: filtered } : d));
      setEditingDim(null);
      showToast('已保存');
    } catch (err) {
      showToast(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-questionnaire-list">
      {DIMENSIONS.map(dim => {
        const current = data.find(d => d.dimension === dim.key);
        const isEditing = editingDim === dim.key;
        return (
          <div key={dim.key} className="admin-questionnaire-dim">
            <div className="admin-questionnaire-header">
              <span className="admin-questionnaire-title">{dim.label}</span>
              <span className="admin-questionnaire-key">{dim.key}</span>
              <span style={{ fontSize: '12px', color: '#9ca3af', marginLeft: 'auto' }}>{dim.desc}</span>
            </div>
            {isEditing ? (
              <>
                <div className="admin-option-list">
                  {editOptions.map((opt, idx) => (
                    <div key={idx} className="admin-option-row">
                      <input
                        className="admin-option-input"
                        value={opt}
                        onChange={(e) => updateOption(idx, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(dim); }}
                        placeholder="输入选项内容..."
                      />
                      <button className="admin-btn-remove" onClick={() => removeOption(idx)}>✕</button>
                    </div>
                  ))}
                </div>
                <button className="admin-btn-add-option" onClick={addOption}>+ 添加选项</button>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button className="admin-btn-save" onClick={() => handleSave(dim)} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button className="admin-btn-cancel" onClick={() => setEditingDim(null)}>取消</button>
                </div>
              </>
            ) : (
              <div className="admin-option-list">
                {(current?.options || []).map((opt, idx) => (
                  <div key={idx} className="admin-option-row" style={{ cursor: 'default' }}>
                    <span style={{ fontSize: '14px', color: '#374151', flex: 1 }}>{opt}</span>
                  </div>
                ))}
                {(current?.options || []).length === 0 && (
                  <span style={{ fontSize: '13px', color: '#9ca3af' }}>暂无选项</span>
                )}
              </div>
            )}
            {!isEditing && (
              <button className="admin-btn-save" style={{ marginTop: '10px' }} onClick={() => startEdit(dim)}>
                编辑选项
              </button>
            )}
          </div>
        );
      })}
      {toast && <div className="admin-toast">{toast}</div>}
    </div>
  );
}
