import { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import RequireAuth from '../router/RequireAuth.jsx';
import { BASE } from '../api.js';

const AD_DURATION_SEC = 5;

const STYLE_EMOJIS = ['💄', '✨', '🌸', '💎'];

function navigateBack() {
  window.history.pushState({}, '', '/home');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function AdOverlay({ duration, onComplete }) {
  const [remain, setRemain] = useState(duration);
  // useMemo + useRef: 用 ref 持有最新的 onComplete，避免把它放进 effect deps
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    console.log('[Tier2Result] AdOverlay effect start, duration=', duration, 'remain=', remain);
    if (duration <= 0) { onCompleteRef.current(); return; }
    const t = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(t);
          setTimeout(() => onCompleteRef.current(), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => { clearInterval(t); console.log('[Tier2Result] AdOverlay cleanup'); };
  }, [duration]); // 只依赖 duration，onComplete 通过 ref 读取最新值
  console.log('[Tier2Result] AdOverlay render, remain=', remain);
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

export default function Tier2Result() {
  const { token } = useContext(AuthContext);

  const state = window.history.state || {};
  const reportId = state.reportId ?? null;

  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [imgUnlockLoading, setImgUnlockLoading] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [imgResult, setImgResult] = useState(null);
  const [retryable, setRetryable] = useState(false);
  // 用于记录当前解锁调用是否已响应，防止多次并发请求
  const unlockBusyRef = useRef(false);

  // ── 加载 tier2 文字内容 ─────────────────────────────────────────
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    async function load() {
      console.log('[Tier2Result] 开始加载内容, reportId=', reportId);
      try {
        const res = await fetch(BASE + '/tier2/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reportId }),
        });
        const data = await res.json();
        console.log('[Tier2Result] 内容加载响应 status=', res.status, 'data=', JSON.stringify(data).slice(0, 200));
        if (!res.ok) throw new Error(data?.error || `请求失败 ${res.status}`);
        if (!cancelled) {
          setContent(data.content);
          setLoadError(null);
        }
      } catch (e) {
        console.error('[Tier2Result] 内容加载失败:', e.message);
        if (!cancelled) setLoadError(e.message);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [reportId, token]);

  // ── 点击解锁按钮 ─────────────────────────────────────────────────
  const handleUnlockImage = useCallback(() => {
    console.log('[Tier2Result] handleUnlockImage 被调用, reportId=', reportId, 'imgUnlockLoading=', imgUnlockLoading, 'unlockBusyRef=', unlockBusyRef.current);
    if (!reportId || imgUnlockLoading || unlockBusyRef.current) return;
    setShowAd(true);
    setImgResult(null);
    setRetryable(false);
    unlockBusyRef.current = true;
  }, [reportId, imgUnlockLoading]);

  // ── 广告结束 → 调 unlock-image ─────────────────────────────────
  const handleAdFinish = useCallback(async () => {
    console.log('[Tier2Result] handleAdFinish 触发 (广告结束)');
    setShowAd(false);
    setImgUnlockLoading(true);
    try {
      console.log('[Tier2Result] 发起 unlock-image 请求, reportId=', reportId);
      const res = await fetch(BASE + '/tier2/unlock-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportId }),
      });
      console.log('[Tier2Result] unlock-image 响应 status=', res.status, 'body=', (await res.clone().text()).slice(0, 300));
      // 重新拿一次 json（上面 clone 已消费 readable stream）
      const data = await res.json();
      console.log('[Tier2Result] unlock-image 解析后 data=', JSON.stringify(data).slice(0, 300));

      if (!res.ok) {
        // 401 / 403 → token 失效
        if (res.status === 401 || res.status === 403) {
          setImgResult({ reason: 'auth_expired', message: '登录状态已过期，请重新登录' });
        } else {
          setImgResult({ reason: 'unknown', message: data?.error || '解锁失败' });
        }
        return;
      }

      if (data.unlocked && data.imageUrl) {
        console.log('[Tier2Result] 解锁成功, imageUrl=', data.imageUrl);
        setImgResult({ imageUrl: data.imageUrl });
      } else if (data.reason === 'referral_not_confirmed') {
        setImgResult({ reason: 'referral_not_confirmed' });
      } else if (data.reason === 'daily_limit_exceeded') {
        setImgResult({ reason: 'daily_limit_exceeded' });
      } else if (data.reason === 'ai_generation_failed' || data.retryable) {
        setImgResult({ reason: 'ai_generation_failed' });
        setRetryable(true);
      } else {
        setImgResult({ reason: 'unknown', message: '未知响应' });
      }
    } catch (e) {
      console.error('[Tier2Result] unlock-image 请求异常:', e);
      setImgResult({ reason: 'network_error', message: e.message || '网络异常' });
      setRetryable(true);
    } finally {
      setImgUnlockLoading(false);
      unlockBusyRef.current = false;
    }
  }, [reportId, token]);

  // ── 重试（不重新看广告）──────────────────────────────────────────
  const handleRetryUnlock = useCallback(() => {
    console.log('[Tier2Result] handleRetryUnlock 被调用');
    setImgResult(null);
    setRetryable(false);
    setShowAd(true);
  }, []);

  return (
    <RequireAuth fallbackPath="/home">
      <div className="tier2-result-page">
        {/* Header */}
        <div className="tier2-result-header">
          <button className="tier2-result-back-btn" onClick={navigateBack}>‹ 返回</button>
          <span className="tier2-result-title">详细美妆报告</span>
          <div className="tier2-result-header-spacer" />
        </div>

        {/* Loading */}
        {content === null && loadError === null && (
          <div className="tier2-result-loading">加载中…</div>
        )}

        {/* Load error */}
        {loadError !== null && content === null && (
          <div className="tier2-result-error">
            <p>加载失败：{loadError}</p>
            <button className="tier2-retry-btn" onClick={() => window.location.reload()}>重试</button>
          </div>
        )}

        {/* Content */}
        {content !== null && (
          <>
            {/* 风格徽章 */}
            <div className="tier2-result-hero">
              <div className="tier2-result-style-badge">
                {STYLE_EMOJIS[Math.floor(Math.random() * STYLE_EMOJIS.length)]}
                <span>{content.style || '个性化美妆建议'}</span>
              </div>
              {content.reason && (
                <p className="tier2-result-reason">{content.reason}</p>
              )}
            </div>

            {/* 核心妆容建议 */}
            {content.coreMakeup && (
              <div className="tier2-result-section">
                <h2 className="tier2-result-section-title">核心妆容建议</h2>
                <div className="tier2-result-core-card">
                  <p className="tier2-result-core-text">{content.coreMakeup}</p>
                </div>
              </div>
            )}

            {/* 分维度建议 */}
            {Array.isArray(content.keyAreas) && content.keyAreas.length > 0 && (
              <div className="tier2-result-section">
                <h2 className="tier2-result-section-title">分维度建议</h2>
                <div className="tier2-result-key-areas">
                  {content.keyAreas.map((area, i) => (
                    <div key={i} className="tier2-result-area-item">
                      <span className="tier2-result-area-num">{i + 1}</span>
                      <p className="tier2-result-area-text">{area}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 完整妆效配方 */}
            {content.formula && (
              <div className="tier2-result-section">
                <h2 className="tier2-result-section-title">完整妆效配方</h2>
                <div className="tier2-result-formula-card">
                  <p className="tier2-result-formula-text">{content.formula}</p>
                </div>
              </div>
            )}

            {/* 产品推荐 */}
            {Array.isArray(content.productRecs) && content.productRecs.length > 0 && (
              <div className="tier2-result-section">
                <h2 className="tier2-result-section-title">推荐产品类型</h2>
                <div className="tier2-result-product-tags">
                  {content.productRecs.map((rec, i) => (
                    <span key={i} className="tier2-result-product-tag">{rec}</span>
                  ))}
                </div>
              </div>
            )}

            {/* AI 效果图区块 */}
            <div className="tier2-result-section">
              <h2 className="tier2-result-section-title">AI 妆效效果图</h2>
              {!showAd && !imgUnlockLoading && imgResult === null && (
                <div className="tier2-result-img-cta">
                  <button className="tier2-result-img-btn" onClick={handleUnlockImage}>
                    🎬 看广告解锁效果图
                  </button>
                  <p className="tier2-result-img-hint">观看 5 秒广告即可解锁专属妆效预览图</p>
                </div>
              )}

              {imgUnlockLoading && (
                <div className="tier2-result-img-loading">正在生成你的妆效美图…</div>
              )}

              {imgResult && imgResult.imageUrl && (
                <div className="tier2-result-img-result">
                  <img src={imgResult.imageUrl} alt="AI 妆效效果图" className="tier2-result-img" />
                </div>
              )}

              {imgResult && !imgResult.imageUrl && (
                <div className="tier2-result-img-fail">
                  {imgResult.reason === 'referral_not_confirmed' && (
                    <>
                      <p className="tier2-result-fail-text">还需要好友完成分析才能解锁效果图</p>
                      <button className="tier2-result-retry-btn" onClick={handleUnlockImage}>稍后重试</button>
                    </>
                  )}
                  {imgResult.reason === 'daily_limit_exceeded' && (
                    <p className="tier2-result-fail-text">今日解锁次数已用完，明天再来吧</p>
                  )}
                  {imgResult.reason === 'ai_generation_failed' && (
                    <>
                      <p className="tier2-result-fail-text">生成失败，请重试</p>
                      {retryable && (
                        <button className="tier2-result-retry-btn" onClick={handleRetryUnlock}>重试</button>
                      )}
                    </>
                  )}
                  {(imgResult.reason === 'auth_expired' || imgResult.reason === 'network_error' || imgResult.reason === 'unknown') && (
                    <>
                      <p className="tier2-result-fail-text">
                        {imgResult.message || '解锁失败，请稍后重试'}
                      </p>
                      {imgResult.reason !== 'auth_expired' && (
                        <button className="tier2-result-retry-btn" onClick={handleUnlockImage}>重试</button>
                      )}
                      {imgResult.reason === 'auth_expired' && (
                        <button
                          className="tier2-result-retry-btn"
                          onClick={() => {
                            localStorage.removeItem('session_token');
                            window.location.href = '/login';
                          }}
                        >
                          重新登录
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 底部分享按钮（占位） */}
            <div className="tier2-result-footer">
              <button
                className="tier2-result-share-btn"
                onClick={() => {
                  // TODO [tier2-share]: 实现 tier2 报告分享逻辑
                  console.log('[Tier2Result] 分享按钮点击，报告ID:', reportId);
                }}
              >
                分享报告
              </button>
            </div>
          </>
        )}

        {/* 模拟广告遮罩 */}
        {showAd && (
          <AdOverlay duration={AD_DURATION_SEC} onComplete={handleAdFinish} />
        )}
      </div>
    </RequireAuth>
  );
}
