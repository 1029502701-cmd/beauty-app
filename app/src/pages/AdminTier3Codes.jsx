import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api.js';

function formatTs(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts * 1000).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(ts);
  }
}

export default function AdminTier3Codes() {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState({ total: 0, unusedCount: 0, usedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(5);
  const [toast, setToast] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const loadList = useCallback(() => {
    setLoading(true);
    adminApi.listTier3Codes()
      .then((data) => {
        setList(data.list || []);
        setStats({ total: data.total || 0, unusedCount: data.unusedCount || 0, usedCount: data.usedCount || 0 });
      })
      .catch(() => showToast('加载失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const handleGenerate = async () => {
    const n = Math.max(1, Math.min(100, parseInt(count, 10) || 1));
    setGenerating(true);
    try {
      const data = await adminApi.generateTier3Codes(n);
      if (data.codes?.length) {
        showToast('已生成 ' + data.codes.length + ' 个兑换码');
        loadList();
      } else {
        showToast('生成失败');
      }
    } catch {
      showToast('生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast('已复制到剪贴板');
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      showToast('复制失败');
    }
  };

  return (
    <div>
      {/* 生成操作栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>生成数量</span>
          <input
            type="number"
            min="1"
            max="100"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            style={{
              width: '72px', height: '36px', padding: '0 10px', fontSize: '13px',
              border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            height: '36px', padding: '0 20px', fontSize: '13px', fontWeight: 600,
            color: '#fff', background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
            border: 'none', borderRadius: '9px', cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(20,184,166,.3)',
            opacity: generating ? .5 : 1,
          }}
        >
          {generating ? '生成中…' : '生成兑换码'}
        </button>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: '总数量', value: stats.total, color: '#6b7280' },
          { label: '未使用', value: stats.unusedCount, color: '#14b8a6' },
          { label: '已使用', value: stats.usedCount, color: '#f59e0b' },
        ].map((card) => (
          <div key={card.label} style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px',
            padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '4px',
          }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>{card.label}</span>
            <span style={{ fontSize: '22px', fontWeight: 700, color: card.color }}>{card.value}</span>
          </div>
        ))}
      </div>

      {/* 兑换码列表 */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>加载中…</div>
      ) : list.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
          暂无兑换码，点击上方"生成兑换码"按钮创建
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['兑换码', '状态', '使用人', '使用时间', '生成时间', '操作'].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((item) => (
                <tr key={item.code} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '14px', fontWeight: 600, letterSpacing: '.05em', color: '#1f2937' }}>
                    {item.code}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 500,
                      background: item.status === 'unused' ? '#d1fae5' : '#fef3c7',
                      color: item.status === 'unused' ? '#059669' : '#d97706',
                    }}>
                      {item.status === 'unused' ? '未使用' : '已使用'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', color: item.userPhone ? '#374151' : '#9ca3af' }}>
                    {item.userPhone || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{item.usedAt ? formatTs(item.usedAt) : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{formatTs(item.createdAt)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {item.status === 'unused' && (
                      <button
                        onClick={() => handleCopy(item.code)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '12px', color: copiedCode === item.code ? '#14b8a6' : '#6b7280',
                          fontWeight: 500, padding: '0',
                        }}
                      >
                        {copiedCode === item.code ? '✓ 已复制' : '复制'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#1f2937', color: '#fff', padding: '10px 24px', borderRadius: '8px',
          fontSize: '13px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,.15)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
