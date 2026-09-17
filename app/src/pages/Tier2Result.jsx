import { useContext, useState, useCallback, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import RequireAuth from '../router/RequireAuth.jsx';
const AD_DURATION_SEC = 5;

function navigateBack() {
  window.location.href = 'https://auth.meijian.top/home';
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
  const mainLink = product.itemUrl || '';
  const curated = product.curatedProduct;
  const curatedLink = curated?.itemUrl || '';
  return (
    <div className="t2-product-card">
      <div className="t2-product-row">
        {product.imageUrl && (
          <img src={product.imageUrl} alt={product.name} className="t2-product-img" />
        )}
        <div className="t2-product-info">
          <div className="t2-product-name">{product.name}</div>
          {product.reason && <div className="t2-product-reason">💡 {product.reason}</div>}
          {product.desc && <div className="t2-product-desc">{product.desc}</div>}
          {product.price && <div className="t2-product-price">💰 {product.price}</div>}
          {mainLink && (
            <div className="t2-product-link-row">
              <span className="t2-product-link-text">{mainLink}</span>
              <button className="t2-copy-btn" onClick={() => { navigator.clipboard.writeText(mainLink); }} title="复制">📋</button>
            </div>
          )}
        </div>
      </div>
      {curated && (
        <div className="t2-product-row">
          {curated.imageUrl && (
            <img src={curated.imageUrl} alt={curated.name} className="t2-product-img" />
          )}
          <div className="t2-product-info">
            <div className="t2-product-name"><span className="t2-product-curated-tag">备选</span>{curated.name}</div>
            {curated.reason && <div className="t2-product-reason">💡 {curated.reason}</div>}
            {curated.price && <div className="t2-product-price">💰 {curated.price}</div>}
            {curatedLink && (
              <div className="t2-product-link-row">
                <span className="t2-product-link-text">{curatedLink}</span>
                <button className="t2-copy-btn" onClick={() => { navigator.clipboard.writeText(curatedLink); }} title="复制">📋</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 每个维度只展示「匹配度最高」的一件：优先带 curatedProduct（高匹配）的那件，
// 其次首个已解析到淘宝链接的主推，其余不展示
function pickTopProduct(products) {
  if (!Array.isArray(products) || products.length === 0) return null;
  for (const p of products) {
    if (p && p.curatedProduct) {
      const c = p.curatedProduct;
      return {
        name: c.name || p.name,
        price: c.price,
        imageUrl: c.imageUrl,
        itemUrl: c.itemUrl,
        shopTitle: c.shopTitle,
        reason: c.reason,
        desc: p.desc,
      };
    }
  }
  const main = products.find((p) => p && (p.itemUrl || p.imageUrl));
  if (main) return { ...main, curatedProduct: null };
  return { ...products[0], curatedProduct: null };
}

export default function Tier2Result({ content, isMock, btnStyle, onUnlockImage, facePhotoUrl }) {
  const [showAd, setShowAd] = useState(false);
  const [modalDim, setModalDim] = useState(null);

  const handleAdFinish = useCallback(() => {
    setShowAd(false);
    onUnlockImage && onUnlockImage();
  }, [onUnlockImage]);

  const openProductModal = useCallback((dimKey) => {
    setModalDim(dimKey);
  }, []);

  const productRecs = content ? content.productRecs : {};
  const steps = content?.steps || [];
  const style = content ? content.style : '';
  const coreConclusion = content ? content.coreConclusion : '';
  const overallTips = content ? content.overallTips : '';

  return (
    <RequireAuth>
      <div className="t2-page">
        {/* Hero */}
        <div className="t2-card t2-card--hero t2-anim">
          <div className="t2-hero-top">
            {facePhotoUrl ? (
              <img className="t2-hero-portrait" src={facePhotoUrl} alt="你的照片" />
            ) : (
              <div className="t2-hero-portrait t2-hero-portrait--ph">📷</div>
            )}
            <div className="t2-hero-right">
              <div className="t2-hero-badge">+ AI BEAUTY REPORT +</div>
              <h1 className="t2-hero-main-title">风格进阶报告</h1>
              <div className="t2-hero-subtitle">
                <span className="t2-hero-line">—</span>
                <span>{style || '温柔知性风'}妆容方案</span>
                <span className="t2-hero-line">—</span>
              </div>
            </div>
          </div>
          {coreConclusion && (
            <div className="t2-hero-decode">
              <div className="t2-hero-decode-label">方案解读</div>
              <p className="t2-hero-decode-text">{coreConclusion}</p>
              <div className="t2-hero-keywords">
                {(content?.style || '').split(/[,，\s]+/).filter(Boolean).map((kw) => (
                  <span key={kw} className="t2-hero-kw">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {isMock && (
          <div className="t2-ai-hint" style={{ textAlign: 'center', marginBottom: '4px' }}>
            ⚡ 静态预览模式（使用模拟数据）
          </div>
        )}

        {/* Report content */}
        {content && (
          <>
            {/* 1. 六步骤卡片 */}
            {steps.map((step, idx) => {
              const products = productRecs[step.key] || step.products || [];
              return (
                <div key={step.key || idx} style={{ animationDelay: `${Math.min(idx * 0.08, 0.48)}s` }} className="t2-card t2-step-card t2-anim">
                  <div className="t2-step-title-row">
                    <span className="t2-step-badge">{String(idx + 1).padStart(2, '0')}</span>
                    <h2 className="t2-step-title">{step.label}</h2>
                    {products.length > 0 && (
                      <button
                        className="t2-lightbulb-btn"
                        onClick={() => openProductModal(step.key)}
                        title="查看高度匹配"
                      >💡</button>
                    )}
                  </div>
                  {step.analysis && (
                    <div className="t2-step-section">
                      <div className="t2-step-section-label">面部分析</div>
                      <p className="t2-step-section-text">{step.analysis}</p>
                    </div>
                  )}
                  {step.why && (
                    <div className="t2-step-section t2-step-why">
                      <div className="t2-step-section-label">为什么这样推荐</div>
                      <p className="t2-step-section-text">{step.why}</p>
                    </div>
                  )}
                  {step.steps && (
                    <div className="t2-step-section t2-step-detail">
                      <div className="t2-step-section-label">步骤</div>
                      <p className="t2-step-detail-text">{step.steps}</p>
                    </div>
                  )}
                  {step.tips && (
                    <div className="t2-step-section t2-step-tips">
                      <div className="t2-step-tips-label">
                        <span className="t2-tips-icon">⚠</span>
                        <span>避雷提示</span>
                      </div>
                      <div className="t2-step-tips-bullets">
                        {step.tips.split('\uff1b').map((t, i) => (
                          <div key={i} className="t2-tips-bullet">· {t.trim()}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 2. 总结 */}
            {overallTips && (
              <div className="t2-card t2-summary-card t2-anim">
                <h2 className="t2-section-title">📌 妆容总结</h2>
                <p className="t2-summary-text">{overallTips}</p>
              </div>
            )}

            {/* 3. 达人匹配模块 */}
            <div className="t2-card t2-influencer-placeholder t2-anim">
              <h2 className="t2-section-title">👩 专属达人推荐</h2>
                <div className="t2-influencer-loading">
                  <div className="t2-influencer-avatar">&#x1F465;&#xFE0F;</div>
                  <div className="t2-influencer-skeleton">
                    <div className="t2-skeleton-line" style={{width:'60%'}}></div>
                    <div className="t2-skeleton-line" style={{width:'40%'}}></div>
                    <div className="t2-skeleton-line" style={{width:'80%'}}></div>
                  </div>
                </div>
              <p className="t2-influencer-hint">正在为你匹配最合适的妆容达人，敬请期待…</p>
            </div>

            {/* 5. 底部分享按钮 */}
            <div className="t2-footer">
              <button className="t2-share-btn" style={btnStyle} onClick={() => console.log('[Tier2Result] 分享按钮点击')}>
                分享报告
              </button>
            </div>
          </>
        )}

        {showAd && <AdOverlay duration={AD_DURATION_SEC} onComplete={handleAdFinish} />}

        {/* 高度匹配弹窗 */}
        {modalDim && (
          <div className="t2-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModalDim(null); }}>
            <div className="t2-modal-overlay-inner">
              <button className="t2-modal-close" onClick={() => setModalDim(null)}>✕</button>
              <h3 className="t2-modal-title">高度匹配</h3>
              {(() => {
                const top = pickTopProduct(productRecs[modalDim] || []);
                return top ? <ProductCard product={top} /> : <p className="t2-modal-empty">暂无高度匹配商品</p>;
              })()}
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
