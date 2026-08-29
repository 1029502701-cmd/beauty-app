import { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import RequireAuth from '../router/RequireAuth.jsx';
import { BASE } from '../api.js';
import { removeStorageItem, STORAGE_KEYS } from '../utils/storage.js';

const AD_DURATION_SEC = 5;
const DIMENSION_META = [
  { key: 'faceShape',       label: '脸型',   icon: '◎', area: 'area_faceShape' },
  { key: 'skinType',        label: '肤质',   icon: '◉', area: 'area_skinType' },
  { key: 'eyebrowShape',    label: '眉形',   icon: '❖', area: 'area_eyebrowShape' },
  { key: 'eyeShape',        label: '眼型',   icon: '◐', area: 'area_eyeShape' },
  { key: 'threeFiveRatio',  label: '三庭五眼', icon: '☰', area: 'area_threeFiveRatio' },
  { key: 'symmetry',        label: '对称度', icon: '⚖', area: 'area_symmetry' },
];

function navigateBack() {
  window.history.pushState({}, '', '/home');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function AdOverlay({ duration, onComplete }) {
  const [remain, setRemain] = useState(duration);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    if (duration <= 0) { onCompleteRef.current(); return; }
    const t = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) { clearInterval(t); setTimeout(() => onCompleteRef.current(), 0); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => { clearInterval(t); };
  }, [duration]);
  return (
    <div className="tier2-ad-overlay">
      <div className="tier2-ad-inner">
        <div className="tier2-ad-icon">📺</div>
        <p className="tier2-ad-title">广告播放中</p>
        <p className="tier2-ad-sub">效果美图即将呈现，请稍候…</p>
        <div className="tier2-ad-countdown">{remain}s</div>
        <div className="tier2-ad-bar-wrap">
          <div className="tier2-ad-bar-fill" style={{ width: `${((duration - remain) / duration) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }) {
  if (!product) return null;
  const link = product.itemUrl || product.curatedProduct?.itemUrl || '#';
  return (
    <div className="t2-product-card">
      {product.imageUrl && (
        <img src={product.imageUrl} alt={product.name} className="t2-product-img" />
      )}
      <div className="t2-product-info">
        <div className="t2-product-name">{product.name}</div>
        {product.desc && <div className="t2-product-desc">{product.desc}</div>}
        {product.price && <div className="t2-product-price">💰 {product.price}</div>}
        {link !== '#' && (
          <div className="t2-product-link-row">
            <span className="t2-product-link-text">{link}</span>
            <button className="t2-copy-btn" onClick={() => { navigator.clipboard.writeText(link); }} title="复制">📋</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Tier2Result() {
  const { token } = useContext(AuthContext);
  const state = window.history.state || {};
  const reportId = state.reportId ?? (new URLSearchParams(window.location.search).get('reportId')) ?? null;

  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [imgUnlockLoading, setImgUnlockLoading] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [imgResult, setImgResult] = useState(null);
  const [retryable, setRetryable] = useState(false);
  const unlockBusyRef = useRef(false);
  const [adminConfig, setAdminConfig] = useState({});
  const [modalDim, setModalDim] = useState(null);

  useEffect(() => {
    fetch(BASE + '/admin/config')
      .then(r => r.json())
      .then(data => {
        const cfg = {};
        (data.configs || []).forEach(c => { cfg[c.key] = c.value; });
        setAdminConfig(cfg);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(BASE + '/tier2/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reportId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `请求失败 ${res.status}`);
        if (!cancelled) { setContent(data.content); setLoadError(null); }
      } catch (e) {
        if (!cancelled) setLoadError(e.message);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [reportId, token]);

  const handleUnlockImage = useCallback(() => {
    if (!reportId || imgUnlockLoading || unlockBusyRef.current) return;
    setShowAd(true); setImgResult(null); setRetryable(false);
    unlockBusyRef.current = true;
    fetch(BASE + '/tier2/unlock-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reportId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setImgResult({ success: true, imageUrl: data.imageUrl });
        } else {
          setImgResult({ success: false, reason: data.reason || 'unknown' });
          setRetryable(data.retryable || false);
        }
      })
      .catch(() => {
        setImgResult({ success: false, reason: 'network_error' });
        setRetryable(true);
      })
      .finally(() => { unlockBusyRef.current = false; });
  }, [reportId, token, imgUnlockLoading]);

  const handleRetryUnlock = useCallback(() => {
    setImgResult(null); setRetryable(false);
    handleUnlockImage();
  }, [handleUnlockImage]);

  const handleAdFinish = useCallback(() => {
    setShowAd(false);
    fetch(BASE + '/tier2/unlock-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reportId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setImgResult({ success: true, imageUrl: data.imageUrl });
        } else {
          setImgResult({ success: false, reason: data.reason || 'unknown' });
          setRetryable(data.retryable || false);
        }
      })
      .catch(() => {
        setImgResult({ success: false, reason: 'network_error' });
        setRetryable(true);
      });
  }, [reportId, token]);

  const openProductModal = useCallback((key) => {
    setModalDim(prev => prev === key ? null : key);
  }, []);

  const btnColor = adminConfig['tier2_btn_color'] || '#000000';
  const showAiImageModule = adminConfig['tier2_show_ai_image'] !== 'false';

  if (!reportId) {
    return (
      <RequireAuth>
        <div className="t2-page">
          <div className="t2-back-btn" onClick={navigateBack}>‹ 返回</div>
          <div className="t2-empty">报告ID不存在，请重新进入</div>
        </div>
      </RequireAuth>
    );
  }

  const btnStyle = { background: btnColor };

  return (
    <RequireAuth>
      <div className="t2-page">
        <div className="t2-back-btn" onClick={navigateBack}>‹ 返回</div>

        {loadError ? (
          <div className="t2-error">
            <div className="t2-error-icon">😿</div>
            <p className="t2-error-text">报告加载失败：{loadError}</p>
            <button className="t2-btn t2-btn-retry" style={btnStyle} onClick={() => window.location.reload()}>重试</button>
          </div>
        ) : !content ? (
          <div className="t2-loading">
            <div className="t2-spinner" />
            <p>正在生成报告，请稍候…</p>
          </div>
        ) : (
          <>
            {/* 1. AI效果图模块 */}
            {showAiImageModule && (
              <div className="t2-card t2-card--hero">
                <div className="t2-card-corner" />
                <div className="t2-hero-content">
                  <div className="t2-hero-emoji">🤖</div>
                  <h2 className="t2-hero-title">AI 妆效预览</h2>
                  <p className="t2-hero-reason">基于你的面部特征，AI 生成了专属妆容效果图</p>
                  {!imgResult ? (
                    <div className="t2-ai-cta">
                      <button className="t2-btn t2-btn-unlock" style={btnStyle} onClick={handleUnlockImage}>🎬 看广告解锁效果图</button>
                      <p className="t2-ai-hint">观看 5 秒广告即可解锁专属妆效预览图</p>
                    </div>
                  ) : imgResult.success ? (
                    <div className="t2-ai-result">
                      <img src={imgResult.imageUrl} alt="AI妆效图" className="t2-ai-img" />
                    </div>
                  ) : (
                    <div className="t2-ai-fail">
                      <p className="t2-fail-text">{imgResult.reason === 'auth_expired' ? '登录已过期，请重新登录' : imgResult.reason === 'daily_limit_exceeded' ? '今日解锁次数已用完' : '生成失败，请重试'}</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {imgResult.reason !== 'daily_limit_exceeded' && (
                          <button className="t2-btn t2-btn-small" style={btnStyle} onClick={handleUnlockImage}>稍后重试</button>
                        )}
                        {retryable && <button className="t2-btn t2-btn-small" style={btnStyle} onClick={handleRetryUnlock}>重试</button>}
                        {imgResult.reason !== 'auth_expired' && <button className="t2-btn t2-btn-small" style={btnStyle} onClick={handleUnlockImage}>重试</button>}
                        {imgResult.reason === 'auth_expired' && <button className="t2-btn t2-btn-small" style={btnStyle} onClick={async () => { await removeStorageItem(STORAGE_KEYS.SESSION_TOKEN); window.location.href = '/login'; }}>重新登录</button>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. 核心结论 */}
            {content.coreConclusion && (
              <div className="t2-card">
                <div className="t2-card-corner" />
                <h2 className="t2-section-title">💎 核心结论</h2>
                <p className="t2-dim-section-text">{content.coreConclusion}</p>
              </div>
            )}

            {/* 3. 六维度详细分析 */}
            {DIMENSION_META.map(dim => {
              const areaKey = dim.area;
              const areaContent = content[areaKey] || content.keyAreas?.[DIMENSION_META.indexOf(dim)] || null;
              const pros = areaContent?.pros;
              const reason = areaContent?.reason || areaContent?.why;
              const tips = areaContent?.tips || areaContent?.howToAvoid;
              const products = content.productRecs?.[dim.key] || [];
              return (
                <div key={dim.key} className="t2-card t2-dim-card" style={{ position: 'relative' }}>
                  <div className="t2-card-corner" />
                  <div className="t2-dim-header">
                    <div className="t2-dim-header-left">
                      <span className="t2-dim-icon">{dim.icon}</span>
                      <h2 className="t2-dim-title">{dim.label}</h2>
                    </div>
                  </div>
                  {products.length > 0 && (
                    <button
                      className="t2-lightbulb-btn"
                      style={{ position: 'absolute', top: '12px', right: '12px' }}
                      onClick={() => openProductModal(dim.key)}
                      title="查看商品推荐"
                    >💡</button>
                  )}
                  {pros && <div className="t2-dim-section t2-dim-pros"><div className="t2-dim-section-label">✨ 优点</div><p className="t2-dim-section-text">{typeof pros === 'string' ? pros : JSON.stringify(pros)}</p></div>}
                  {reason && <div className="t2-dim-section t2-dim-reason"><div className="t2-dim-section-label">🔍 匹配原理</div><p className="t2-dim-section-text">{reason}</p></div>}
                  {tips && <div className="t2-dim-section t2-dim-tips"><div className="t2-dim-section-label">⚠️ 避坑指南</div><p className="t2-dim-section-text">{typeof tips === 'string' ? tips : JSON.stringify(tips)}</p></div>}
                </div>
              );
            })}

            {/* 4. 完整妆效配方 */}
            {content.formula && (
              <div className="t2-card">
                <div className="t2-card-corner" />
                <h2 className="t2-section-title">完整妆效配方</h2>
                <p className="t2-formula-text">{content.formula}</p>
              </div>
            )}

            {/* 5. 总结模块 */}
            {content.overallTips && (
              <div className="t2-card t2-summary-card">
                <div className="t2-card-corner" />
                <h2 className="t2-section-title">📌 妆容总结</h2>
                <p className="t2-summary-text">{content.overallTips}</p>
              </div>
            )}

            {/* 6. 达人匹配模块 */}
            <div className="t2-card t2-influencer-placeholder">
              <div className="t2-card-corner" />
              <h2 className="t2-section-title">👩 专属达人推荐</h2>
              <p className="t2-influencer-hint">正在为你匹配最合适的妆容达人，敬请期待…</p>
            </div>

            {/* 7. Tier3 钩子模块 */}
            <div className="t2-card t2-tier3-hook">
              <div className="t2-card-corner" />
              <div className="t2-tier3-hook-content">
                <div className="t2-tier3-hook-icon">✨</div>
                <p className="t2-tier3-hook-text">{adminConfig['tier2_hook_text'] || '解锁专属报告，搭配更多场景'}</p>
                <button className="t2-btn t2-btn-hook" style={btnStyle} onClick={() => {
                  window.history.pushState({ page: 'tier3' }, '', '/tier3');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}>解锁专属报告</button>
              </div>
            </div>

            {/* 8. 底部分享按钮 */}
            <div className="t2-footer">
              <button className="t2-share-btn" style={btnStyle} onClick={() => console.log('[Tier2Result] 分享按钮点击，报告ID:', reportId)}>分享报告</button>
            </div>
          </>
        )}

        {showAd && <AdOverlay duration={AD_DURATION_SEC} onComplete={handleAdFinish} />}

        {/* 商品推荐弹窗 */}
        {modalDim && (
          <div className="t2-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalDim(null); }}>
            <div className="t2-modal-overlay-inner">
              <button className="t2-modal-close" onClick={() => setModalDim(null)}>✕</button>
              <h3 className="t2-modal-title">商品推荐</h3>
              {(content.productRecs?.[modalDim] || []).map((p, i) => <ProductCard key={i} product={p} />)}
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}