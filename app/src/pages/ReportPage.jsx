import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import RequireAuth from '../router/RequireAuth.jsx';
import Tier2Result from './Tier2Result.jsx';
import { getCompliment } from './complimentMap.js';
import { BASE } from '../api.js';
import { removeStorageItem, STORAGE_KEYS } from '../utils/storage.js';

const RESULT_ITEMS = [
  { key: 'faceShape',        label: '脸型',         icon: '◎' },
  { key: 'skinType',         label: '肤质',         icon: '◉' },
  { key: 'eyebrowShape',     label: '眉形',         icon: '❖', placeholder: '待分析' },
  { key: 'eyeShape',         label: '眼型',         icon: '◐', placeholder: '待分析' },
  { key: 'threeFiveRatio',   label: '三庭五眼',     icon: '☰', placeholder: '待分析' },
  { key: 'symmetry',         label: '五官对称度',   icon: '⚖', placeholder: '待分析' },
];

const AD_DURATION_SEC = 5;


const TIER3_QUESTIONS = [
  { key: 'makeupStyle', title: '今天想要哪种感觉？' },
  { key: 'scenario', title: '这个妆容用在哪里？' },
  { key: 'skillLevel', title: '你的化妆手法是？' },
  { key: 'timeCost', title: '愿意花多久打扮自己？' },
];

const TIER3_FALLBACK_OPTIONS = {
  makeupStyle: ['清透日常风', '精致约会风', '复古港风', '欧美烟熏风', '汉服古风', '职场通勤风'],
  scenario:    ['日常通勤', '约会聚会', '拍照旅行', '婚礼派对', '职场面试'],
  skillLevel:  ['新手入门', '有一定基础', '熟练进阶'],
  timeCost:    ['5分钟极简', '15分钟日常', '30分钟以上精致'],
};

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
          <div className="tier2-ad-bar-fill" style={{ width: ((duration - remain) / duration) * 100 + '%' }} />
        </div>
      </div>
    </div>
  );
}

function Tier3Report({ content, onRefresh }) {
  const { overallAdvice, stepByStep, productRecs, tips, timeWarning, styleNote } = content;
  return (
    <>
      {overallAdvice && (
        <div className="report-section">
          <h2 className="report-section-title">整体建议</h2>
          <div className="report-tier3-advice-card"><p className="report-tier3-advice-text">{overallAdvice}</p></div>
        </div>
      )}
      {styleNote && (
        <div className="report-section">
          <h2 className="report-section-title">风格与场景融合</h2>
          <div className="report-tier3-style-card"><p className="report-tier3-style-text">{styleNote}</p></div>
        </div>
      )}
      {Array.isArray(stepByStep) && stepByStep.length > 0 && (
        <div className="report-section">
          <h2 className="report-section-title">步骤指南</h2>
          <div className="report-tier3-steps">
            {stepByStep.map((s, i) => (
              <div key={i} className="report-tier3-step">
                <div className="report-tier3-step-header">
                  <span className="report-tier3-step-num">{s.step || i + 1}</span>
                  <span className="report-tier3-step-title">{s.title}</span>
                  <span className="report-tier3-step-meta">{s.timeEstimate}{s.difficultyHint ? ' · ' + s.difficultyHint : ''}</span>
                </div>
                <p className="report-tier3-step-desc">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {productRecs && typeof productRecs === 'object' && (
        <div className="report-section">
          <h2 className="report-section-title">推荐产品</h2>
          <div className="report-tier3-products">
            {Object.entries(productRecs).map(([dim, recs]) => {
              if (!Array.isArray(recs) || recs.length === 0) return null;
              const labels = { base: '底妆', eyes: '眼妆', lips: '唇妆', cheeks: '腮红' };
              return (
                <div key={dim} className="report-tier3-prod-group">
                  <span className="report-tier3-prod-group-label">{labels[dim] || dim}</span>
                  <div className="report-tier3-prod-list">
                    {recs.map((rec, j) => (
                      <div key={j} className="report-tier3-prod-card">
                        <span className="report-tier3-prod-name">{rec.name || rec}</span>
                        <span className="report-tier3-prod-reason">{rec.reason || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {Array.isArray(tips) && tips.length > 0 && (
        <div className="report-section">
          <h2 className="report-section-title">贴心提示</h2>
          <ul className="report-tier3-tips">
            {tips.map((t, i) => <li key={i} className="report-tier3-tip">{t}</li>)}
          </ul>
        </div>
      )}
      {timeWarning && (
        <div className="report-section">
          <div className="report-tier3-time-warning">
            <span className="report-tier3-time-icon">⏱</span>
            <p className="report-tier3-time-text">{timeWarning}</p>
          </div>
        </div>
      )}
      <div className="report-tier3-refresh">
        <button className="report-tier3-refresh-btn" onClick={onRefresh}>使用另一个 token 重新生成</button>
      </div>
    </>
  );
}

export default function ReportPage() {
  const { token } = useContext(AuthContext);
  const state = window.history.state || {};
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = state.reportId ?? urlParams.get('id') ?? (window.location.pathname.match(/^\/report\/([^?]+)/)?.[1] || null);

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'tier3' || tab === '专属') return '专属';
    if (tab === '进阶') return '进阶';
    return '初识';
  });
  const [tier1Report, setTier1Report] = useState(null);
  const [preview, setPreview] = useState(state.preview || sessionStorage.getItem('capture_preview') || null);
  const [openPhoto, setOpenPhoto] = useState(null);
  const [tier2Status, setTier2Status] = useState(null);
  const [tier2Content, setTier2Content] = useState(null);
  const [tier2LoadError, setTier2LoadError] = useState(null);
  const [tier2Generation, setTier2Generation] = useState(null);
  const [tier2Processing, setTier2Processing] = useState(false);
  const [imgUnlockLoading, setImgUnlockLoading] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [imgResult, setImgResult] = useState(null);
  const [retryable, setRetryable] = useState(false);
  const unlockBusyRef = useRef(false);
  const shareCardRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const shareUrlRef = useRef('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareDone, setShareDone] = useState(false);
  const [adUnlockLoading, setAdUnlockLoading] = useState(false);
  const [shareDailyLimitExceeded, setShareDailyLimitExceeded] = useState(false);
  const [reportValid, setReportValid] = useState(null); // null = not checked yet
  const tier2TimerRef = useRef(null); // track polling interval to prevent multiple simultaneous timers
  const [btnColor, setBtnColor] = useState("#000000");
  // Tier3 state
  const [tier3TokenStatus, setTier3TokenStatus] = useState(null);
  const [tier3QuestionnaireOptions, setTier3QuestionnaireOptions] = useState(null);
  const [tier3ShowQuestionnaire, setTier3ShowQuestionnaire] = useState(false);
  const [tier3Answers, setTier3Answers] = useState({});
  const tier3AnswersRef = useRef(tier3Answers);
  useEffect(() => { tier3AnswersRef.current = tier3Answers; }, [tier3Answers]);
  const [tier3Generating, setTier3Generating] = useState(false);
  const [tier3Content, setTier3Content] = useState(null);
  const [tier3Error, setTier3Error] = useState(null);
  const [tier3RedeemCode, setTier3RedeemCode] = useState('');
  const [tier3Redeeming, setTier3Redeeming] = useState(false);
  const [tier3LoadError, setTier3LoadError] = useState(null);
  const [tier3PreviewText, setTier3PreviewText] = useState('');
  const [tier3PreviewLoading, setTier3PreviewLoading] = useState(true);
  const [tier3CurrentQuestionIndex, setTier3CurrentQuestionIndex] = useState(0);
  const [tier3AnswerFlash, setTier3AnswerFlash] = useState(null);
  const tier3TimerRef = useRef(null);

  // Load tier1 report from sessionStorage (set by Capture.jsx after analysis)
  useEffect(() => {
    if (!reportId) return;
    const stored = sessionStorage.getItem('capture_report_' + reportId);
    if (stored) {
      try { setTier1Report(JSON.parse(stored)); } catch {}
    }
  }, [reportId]);

  // Validate reportId on load — clears stale/expired IDs before any API call
  useEffect(() => {
    if (!reportId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(BASE + '/tier1/validate?id=' + encodeURIComponent(reportId), {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await res.json();
        if (!cancelled) setReportValid(data.valid ?? false);
      } catch {
        if (!cancelled) setReportValid(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportId, token]);

  // Load tier2 generation status on mount
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(BASE + '/tier2/status?tier1ReportId=' + encodeURIComponent(reportId), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('请求失败: ' + res.status);
        const data = await res.json();
        if (!cancelled) {
          setTier2Generation(data);
          setTier2Status(data);
          if (data.generationStatus === 'ready' && data.content) {
            setTier2Content(data.content);
          }
          // pending 状态也视为需要触发生成（兼容旧数据）
          if (data.generationStatus === 'pending') {
            setTier2Generation({ generationStatus: 'processing', tier2ReportId: data.tier2ReportId });
            setTier2Status({ generationStatus: 'processing', tier2ReportId: data.tier2ReportId });
          }
        }
      } catch {
        if (!cancelled) {
          setTier2Generation({ generationStatus: 'not_found' });
          setTier2Status({ generationStatus: 'not_found' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [reportId, token]);

  // Use a ref for generation state so the interval callback always reads current values.
  // Only depend on [reportId, token] so the interval is created once and never restarted.
  const tier2GenerationRef = useRef(tier2Generation);
  useEffect(() => { tier2GenerationRef.current = tier2Generation; }, [tier2Generation]);

  useEffect(() => {
    if (tier2Generation?.generationStatus !== 'processing') return;
    setTier2Processing(true);
    let aborted = false;
    const interval = setInterval(async () => {
      if (aborted) return;
      const gen = tier2GenerationRef.current;
      if (!reportId || !gen?.tier2ReportId) return;
      try {
        const res = await fetch(BASE + '/tier2/status?tier2Id=' + encodeURIComponent(gen.tier2ReportId), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('请求失败: ' + res.status);
        const data = await res.json();
        if (aborted) return;
        setTier2Generation(data);
        setTier2Status(data);
        if (data.generationStatus === 'ready') {
          aborted = true;
          setTier2Processing(false);
          clearInterval(interval);
          tier2TimerRef.current = null;
          if (data.content) {
            setTier2Content(data.content);
          }
        } else if (data.generationStatus === 'failed') {
          aborted = true;
          setTier2Processing(false);
          clearInterval(interval);
          tier2TimerRef.current = null;
          setTier2Content(null);
        }
      } catch {
        // keep polling on transient errors
      }
    }, 2000);
    tier2TimerRef.current = interval;
    return () => {
      aborted = true;
      if (tier2TimerRef.current) {
        clearInterval(tier2TimerRef.current);
        tier2TimerRef.current = null;
      }
      setTier2Processing(false);
    };
  }, [reportId, token]);


  // Fetch tier2_btn_color from admin config on mount
  useEffect(() => {
    let cancelled = false;
    fetch(BASE + '/config/tier2_btn_color')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.value) setBtnColor(data.value);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!token) return;
    if (activeTab !== '专属') return;
    let cancelled = false;
    async function load() {
      try {
        const [statusRes, optionsRes] = await Promise.all([
          fetch(BASE + '/tier3/token-status', { headers: { Authorization: 'Bearer ' + token } }),
          fetch(BASE + '/tier3/questionnaire-options'),
        ]);
        if (!cancelled) {
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setTier3TokenStatus(statusData);
          }
          if (optionsRes.ok) {
            const optionsData = await optionsRes.json();
            setTier3QuestionnaireOptions(optionsData.options || {});
          }
          const previewRes = await fetch(BASE + '/config/tier3_preview_text');
          if (previewRes.ok) {
            const previewData = await previewRes.json();
            setTier3PreviewText(previewData.value || '专属报告为你提供个性化深度分析，涵盖整体建议、步骤指南和推荐产品。');
            setTier3PreviewLoading(false);
          } else {
            setTier3PreviewText('专属报告为你提供个性化深度分析，涵盖整体建议、步骤指南和推荐产品。');
            setTier3PreviewLoading(false);
          }
        }
      } catch { if (!cancelled) { setTier3LoadError('加载失败'); setTier3PreviewLoading(false); } }
    }
    void load();
    return () => { cancelled = true; };
  }, [activeTab, token]);
  const handleTier3Submit = useCallback(async () => {
    if (!reportId || tier3Generating || !token) return;
    const dims = ['makeupStyle', 'scenario', 'skillLevel', 'timeCost'];
    const missing = dims.filter((d) => !tier3Answers[d]);
    if (missing.length > 0) {
      setTier3Error('请选择所有选项');
      return;
    }
    setTier3Generating(true);
    setTier3Error(null);
    setTier3Content(null);
    try {
      const res = await fetch(BASE + '/tier3/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ tier1ReportId: reportId, questionnaireAnswers: tier3Answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && data.error === 'no_token') {
          setTier3TokenStatus({ hasToken: false, count: 0 });
          setTier3Error('token 已耗尽，请购买后重试');
        } else if (data.retryable) {
          setTier3Error('生成失败，token 未消耗，可重新尝试');
        } else {
          setTier3Error(data?.error || '请求失败 ' + res.status);
        }
      } else {
        setTier3Content(data.content);
        setTier3TokenStatus({ hasToken: false, count: 0 });
      }
    } catch (e) {
      setTier3Error('网络异常，请重试');
    } finally {
      setTier3Generating(false);
    }
  }, [reportId, tier3Generating, token]);
  const handleTier3Back = useCallback(() => {
    setTier3CurrentQuestionIndex((prev) => Math.max(0, prev - 1));
  }, []);
  const handleTier3DoSubmit = useCallback(async () => {
    if (!reportId || tier3Generating || !token) {
        return;
    }
    const dims = ['makeupStyle', 'scenario', 'skillLevel', 'timeCost'];
    const currentAnswers = tier3AnswersRef.current;
    const missing = dims.filter((d) => !currentAnswers[d]);
    if (missing.length > 0) {
      setTier3Error('请选择所有选项');
        return;
    }
    setTier3Generating(true);
    setTier3Error(null);
    setTier3Content(null);
    try {
      const res = await fetch(BASE + '/tier3/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ tier1ReportId: reportId, questionnaireAnswers: tier3AnswersRef.current }),
      });
        const data = await res.json();
      if (!res.ok) {
            if (res.status === 403 && data.error === 'no_token') {
          setTier3TokenStatus({ hasToken: false, count: 0 });
          setTier3Error('token 已耗尽，请购买后重试');
        } else if (data.retryable) {
          setTier3Error('生成失败，token 未消耗，可重新尝试');
        } else {
          setTier3Error(data?.error || '请求失败 ' + res.status);
        }
      } else {
            setTier3Content(data.content);
        setTier3TokenStatus({ hasToken: false, count: 0 });
      }
    } catch (e) {
        setTier3Error('网络异常，请重试');
    } finally {
      setTier3Generating(false);
    }
  }, [reportId, tier3Generating, tier3Answers, token]);

  const handleTier3Answer = useCallback((dimension, value) => {
    const isLastQuestion = (tier3CurrentQuestionIndex === TIER3_QUESTIONS.length - 1);
    if (tier3TimerRef.current) {
      clearTimeout(tier3TimerRef.current);
      tier3TimerRef.current = null;
      }
    setTier3Answers((prev) => {
      const next = { ...prev, [dimension]: value };
        return next;
    });
    setTier3AnswerFlash(dimension);
    tier3TimerRef.current = setTimeout(() => {
        tier3TimerRef.current = null;
      setTier3AnswerFlash(null);
      setTier3CurrentQuestionIndex((prev) => {
        const next = prev + 1;
            if (next >= TIER3_QUESTIONS.length) {
                void handleTier3DoSubmit();
        } else {
                return next;
        }
        return prev;
      });
    }, 320);
  }, [handleTier3DoSubmit, tier3CurrentQuestionIndex]);

  const handleTier3Buy = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(BASE + '/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ channel: 'mock', purpose: 'token_purchase' }),
      });
      const data = await res.json();
      if (res.ok && data.payUrl) {
        var payUrl = data.payUrl + (data.payUrl.includes('?') ? '&' : '?') + 'tab=tier3';
        if (reportId) payUrl += '&id=' + encodeURIComponent(reportId);
        window.location.href = payUrl;
      }
    } catch { setTier3Error('购买失败，请重试'); }
  }, [token]);

  const handleTier3Redeem = useCallback(async () => {
    if (!tier3RedeemCode.trim() || tier3Redeeming || !token) return;
    setTier3Redeeming(true);
    setTier3Error(null);
    try {
      const res = await fetch(BASE + '/tier3/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ code: tier3RedeemCode.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTier3RedeemCode('');
        // 刷新 token 状态
        const statusRes = await fetch(BASE + '/tier3/token-status', {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setTier3TokenStatus(statusData);
        }
      } else {
        setTier3Error(data.message || '兑换失败');
      }
    } catch { setTier3Error('网络异常，请重试'); }
    finally { setTier3Redeeming(false); }
  }, [tier3RedeemCode, tier3Redeeming, token]);

  const handleTier3Refresh = useCallback(async () => {
    setTier3Content(null);
    setTier3Error(null);
    setTier3Answers({});
    setTier3ShowQuestionnaire(false);
    if (token) {
      try {
        const res = await fetch(BASE + '/tier3/token-status', {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (res.ok) {
          const data = await res.json();
          setTier3TokenStatus(data);
          if (data.hasToken) setTier3ShowQuestionnaire(true);
        }
      } catch {}
    }
  }, [token]);

  const handleShareReport = useCallback(async () => {
    if (shareLoading || !reportId) return;
    setShareLoading(true);
    setShareDone(false);
    try {
      const res = await fetch(BASE + '/tier1/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportId }),
      });
      if (!res.ok) {
        if (res.status === 400 || res.status === 429) {
          const errData = await res.json().catch(() => ({}));
          if (errData?.error === 'daily_limit_exceeded') {
            setShareDailyLimitExceeded(true);
            return;
          }
        }
        throw new Error('分享接口请求失败');
      }
      const { shareUrl } = await res.json();
      shareUrlRef.current = shareUrl;
      const QRCode = await import('qrcode');
      await QRCode.default.toCanvas(qrCanvasRef.current, shareUrl, {
        width: 160, margin: 1, color: { dark: '#2d2d2d', light: '#ffffff' },
      });
      await new Promise((r) => setTimeout(r, 50));
      const html2canvas = (await import('html2canvas')).default;
      const cardEl = shareCardRef.current;
      if (!cardEl) throw new Error('分享卡片 DOM 未就绪');
      const canvas = await html2canvas(cardEl, { backgroundColor: null, scale: 2, useCORS: true, allowTaint: true, logging: false });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
      if (!blob) throw new Error('截图生成失败');
      try {
        const file = new File([blob], '美妆分析报告.png', { type: 'image/png' });
        if (navigator.share) {
          await navigator.share({ title: '我的美妆分析报告', text: '看看我的美妆分析结果！\\n' + shareUrl, files: [file] });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = '美妆分析报告.png'; a.click();
          URL.revokeObjectURL(url);
        }
      } catch {}
      setShareDone(true);
      // share.ts 现在返回 tier2ReportId，直接开始轮询
      const shareData = await res.json();
      if (shareData?.tier2ReportId) {
        setTier2Generation({ generationStatus: 'processing', tier2ReportId: shareData.tier2ReportId });
      } else if (tier2Generation?.generationStatus === 'not_found' || tier2Generation?.generationStatus === 'failed') {
        const initRes = await fetch(BASE + '/tier2/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ reportId }),
        });
        const initData = await initRes.json();
        if (initRes.ok && initData?.tier2ReportId) {
          setTier2Generation({ generationStatus: 'processing', tier2ReportId: initData.tier2ReportId });
        }
      }
    } catch (err) { console.error('[ReportPage] 分享异常:', err); }
    finally { setShareLoading(false); }
  }, [shareLoading, reportId, token]);

  const handleUnlockImage = useCallback(() => {
    if (!reportId || imgUnlockLoading || unlockBusyRef.current) return;
    setShowAd(true); setImgResult(null); setRetryable(false);
    unlockBusyRef.current = true;
  }, [reportId, imgUnlockLoading]);

  const handleAdFinish = useCallback(async () => {
    setShowAd(false); setImgUnlockLoading(true);
    try {
      const res = await fetch(BASE + '/tier2/unlock-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reportId: tier2Status?.tier2ReportId || reportId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) setImgResult({ reason: 'auth_expired', message: '登录状态已过期，请重新登录' });
        else setImgResult({ reason: 'unknown', message: data?.error || '解锁失败' });
        return;
      }
      if (data.unlocked && data.imageUrl) setImgResult({ imageUrl: data.imageUrl });
      else if (data.reason === 'referral_not_confirmed') setImgResult({ reason: 'referral_not_confirmed' });
      else if (data.reason === 'daily_limit_exceeded') setImgResult({ reason: 'daily_limit_exceeded' });
      else if (data.reason === 'ai_generation_failed' || data.retryable) { setImgResult({ reason: 'ai_generation_failed' }); setRetryable(true); }
      else setImgResult({ reason: 'unknown', message: '未知响应' });
    } catch (e) { setImgResult({ reason: 'network_error', message: e.message || '网络异常' }); setRetryable(true); }
    finally { setImgUnlockLoading(false); unlockBusyRef.current = false; }
  }, [reportId, token]);

  const handleRetryUnlock = useCallback(() => {
    if (!reportId) return;
    setShowAd(true); setImgResult(null); setRetryable(false);
    unlockBusyRef.current = true;
  }, [reportId]);


  // --- 广告解锁进阶报告（不依赖分享，仅消耗每日限额）---
  const handleAdFinishForTier2 = useCallback(async () => {
    setShowAd(false);
    setAdUnlockLoading(true);
    try {
      const res = await fetch(BASE + '/tier2/unlock-by-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ tier1ReportId: reportId }),
      });
      const data = await res.json();
      if (!res.ok || data?.error === 'daily_limit_exceeded') {
        if (data?.error === 'daily_limit_exceeded') {
          alert(data.message || '今日进阶报告次数已用完，明天再来吧');
        }
        return;
      }
      if (data?.tier2ReportId) {
        setTier2Generation({ generationStatus: 'processing', tier2ReportId: data.tier2ReportId });
      }
    } catch (e) {
      console.error('[ReportPage] unlock-by-ad 异常:', e);
    } finally {
      setAdUnlockLoading(false);
    }
  }, [reportId, token]);

  const initReport = tier1Report;
  const resolvedResults = RESULT_ITEMS.map((item) => {
    const value = initReport?.[item.key] ?? item.placeholder;
    const compliment = getCompliment(item.key, value);
    return { ...item, value, compliment };
  });
  const personaTags = initReport?.personaTags ? [initReport.personaTags] : ['温柔知性风', '清透裸妆感'];
  const highlightText = initReport?.highlight ?? '发现你的独特之美';

  const t2 = tier2Content;

  return (
    <RequireAuth fallbackPath="/home">
      <div className="report-page">
        <div ref={shareCardRef} className="share-card" style={{ position: 'absolute', left: -9999, top: 0 }}>
          <div className="share-card-photo-wrap">
            {preview ? <img className="share-card-photo" src={preview} alt="你的照片" /> : <div className="share-card-photo-placeholder">📷</div>}
          </div>
          <div className="share-card-tags">
            {personaTags.map((tag, i) => <span key={i} className="share-card-tag">{tag}</span>)}
          </div>
          <div className="share-card-highlight"><p className="share-card-highlight-text">{highlightText}</p></div>
          <div className="share-card-qr-wrap"><canvas ref={qrCanvasRef} className="share-card-qr" /><p className="share-card-qr-hint">扫码查看我的分析报告</p></div>
        </div>

        {reportValid === false && (
          <div className="report-invalid-wrap">
            <div className="report-invalid-icon">⚠️</div>
            <p className="report-invalid-title">报告已失效</p>
            <p className="report-invalid-desc">该报告不存在或已被清理，请重新拍照生成。</p>
            <button className="report-invalid-btn" onClick={navigateBack}>返回首页重新拍照</button>
          </div>
        )}

        {reportValid === null && reportId && (
          <div className="report-loading">正在验证报告...</div>
        )}

        {reportValid !== false && reportValid !== null && (
          <>
            <div className="report-header">
          <button className="report-back-btn" onClick={navigateBack}>‹ 返回</button>
          <span className="report-title">美妆分析报告</span>
          <div className="report-header-spacer" />
        </div>

        <div className="report-tabs">
          {['初识', '进阶', '专属'].map((tab) => (
            <button key={tab} className={'report-tab' + (activeTab === tab ? ' report-tab--active' : '')} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>

        {/* 初识 */}
        {activeTab === '初识' && (
          <div className="report-tab-content">
            {!initReport ? <div className="report-loading">加载中...</div> : (
              <>
                <div className="report-hero">
                  {preview ? <img className="report-hero-photo" src={preview} alt="你的照片" style={{ aspectRatio: '3/4' }} onClick={() => setOpenPhoto(preview)} /> : <div className="report-hero-photo-placeholder">📷</div>}
                  <div className="report-hero-tags">
                    {personaTags.map((tag, i) => <span key={i} className="report-hero-tag">{tag}</span>)}
                  </div>
                </div>
                <div className="report-section">
                  <h2 className="report-section-title">分析结果</h2>
                  <div className="report-grid">
                    {resolvedResults.map((item) => (
                      <div key={item.key} className="report-item">
                        <span className="report-item-icon">{item.icon}</span>
                        <div className="report-item-body">
                          <span className="report-item-label">{item.label}</span>
                          <span className="report-item-value">{item.value}</span>
                          <span className="report-item-compliment">— {item.compliment}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="report-section">
                  <h2 className="report-section-title">✨ 你的亮点</h2>
                  <div className="report-highlight-card">
                    <p className="report-highlight-text">{highlightText}</p>
                  </div>
                </div>
                <div className="report-cta">
                  <button className="report-cta-btn" onClick={handleShareReport} disabled={shareLoading || !reportId}>
                    {shareLoading ? '生成分享中…' : shareDone ? '✓ 已分享' : '分享解锁进阶报告'}
                  </button>
                  <p className="report-cta-hint">分享后即可解锁进阶报告</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* 进阶 */}
        {activeTab === '进阶' && (
          <div className="report-tab-content">
            {!reportId ? <div className="report-loading">加载中...</div>
            : !tier2Status ? <div className="report-loading">加载中...</div>
            : tier2Generation?.generationStatus === 'not_found' || tier2Generation?.generationStatus === 'failed' ? (
              <div className="report-unlock-prompt">
                <div className="report-unlock-icon">🔒</div>
                <p className="report-unlock-text">选择方式解锁进阶报告</p>
                <div className="report-unlock-options">
                  <button
                    className="report-unlock-btn"
                    onClick={handleShareReport}
                    disabled={shareLoading || !reportId}
                  >
                    {shareLoading ? '生成分享中…' : '分享解锁'}
                  </button>
                  <button
                    className="report-unlock-btn-alt"
                    onClick={handleAdFinishForTier2}
                    disabled={adUnlockLoading || !reportId}
                  >
                    {adUnlockLoading ? '解锁中…' : '看广告解锁'}
                  </button>
                </div>
                <p className="report-unlock-hint">分享邀请好友完成分析，或观看5秒广告即可解锁</p>
                {shareDailyLimitExceeded && (
                  <p className="report-daily-limit-text">今日进阶报告次数已用完，明天再来吧</p>
                )}
                <button className="report-unlock-btn" onClick={handleShareReport} disabled={shareLoading || !reportId}>
                  {shareLoading ? '生成分享中…' : '去分享解锁'}
                </button>

              </div>
            ) : tier2Generation?.generationStatus === 'failed' ? (
              <div className="report-error">
                <p>生成失败，请稍后重试</p>
                <button onClick={() => {
                  setTier2Generation(null);
                  setTier2Status(null);
                  setTier2Content(null);
                  setTier2LoadError(null);
                }}>重试</button>
              </div>
            ) : tier2Generation?.generationStatus === 'processing' || tier2Processing ? (
              <div className="report-loading"><div className="report-loading-spinner" /><p>AI 正在生成进阶报告，请稍候…</p></div>
            ) : !t2 ? <div className="report-loading">正在生成进阶报告...</div> : (
              <>
                <Tier2Result content={t2} isMock={!tier2Content} btnStyle={{background: btnColor}} onUnlockImage={handleAdFinish} />
                <div className="report-section">
                  <h2 className="report-section-title">AI 妆效效果图</h2>
                  {!showAd && !imgUnlockLoading && imgResult === null && (
                    <div className="report-img-cta">
                      <button className="report-img-btn" onClick={handleUnlockImage}>🎬 看广告解锁效果图</button>
                      <p className="report-img-hint">观看 5 秒广告即可解锁专属妆效预览图</p>
                    </div>
                  )}
                  {imgUnlockLoading && <div className="report-img-loading">正在生成你的妆效美图…</div>}
                  {imgResult && imgResult.imageUrl && (
                    <div className="report-img-result"><img src={imgResult.imageUrl} alt="AI 妆效效果图" className="report-img" /></div>
                  )}
                  {imgResult && !imgResult.imageUrl && (
                    <div className="report-img-fail">
                      {imgResult.reason === 'referral_not_confirmed' && (
                        <><p className="report-fail-text">还需要好友完成分析才能解锁效果图</p>
                        <button className="report-retry-btn" onClick={handleUnlockImage}>稍后重试</button></>
                      )}
                      {imgResult.reason === 'daily_limit_exceeded' && <p className="report-fail-text">今日解锁次数已用完，明天再来吧</p>}
                      {imgResult.reason === 'ai_generation_failed' && (
                        <><p className="report-fail-text">生成失败，请重试</p>
                        {retryable && <button className="report-retry-btn" onClick={handleRetryUnlock}>重试</button>}</>
                      )}
                      {(imgResult.reason === 'auth_expired' || imgResult.reason === 'network_error' || imgResult.reason === 'unknown') && (
                        <><p className="report-fail-text">{imgResult.message || '解锁失败，请稍后重试'}</p>
                        {imgResult.reason !== 'auth_expired' && <button className="report-retry-btn" onClick={handleUnlockImage}>重试</button>}
                        {imgResult.reason === 'auth_expired' && <button className="report-retry-btn" onClick={async () => { await removeStorageItem(STORAGE_KEYS.SESSION_TOKEN); window.location.href = '/login'; }}>重新登录</button>}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* 专属 */}
        {activeTab === '专属' && (
          <div className="report-tab-content">
            {tier3LoadError && <div className="report-error"><p>{tier3LoadError}</p><button onClick={() => { setTier3LoadError(null); }}>重试</button></div>}
            {!tier3TokenStatus ? (
              <div className="report-loading">加载中...</div>
            ) : tier3Content ? (
              <Tier3Report content={tier3Content} onRefresh={handleTier3Refresh} />
            ) : !tier3TokenStatus.hasToken ? (
              <div className="report-unlock-prompt">
                <div className="report-exclusive-icon">🔐</div>
                <p className="report-exclusive-text">专属深度分析报告</p>
                {tier3PreviewLoading ? (
                  <p className="report-exclusive-hint">加载中...</p>
                ) : tier3PreviewText ? (
                  <div className="report-preview-section">
                    <p className="report-preview-label">专属报告包含</p>
                    <div className="report-preview-content" dangerouslySetInnerHTML={{ __html: tier3PreviewText }} />
                  </div>
                ) : null}
                <div className="report-redeem-section">
                  <p className="report-redeem-hint">已有兑换码？在此输入：</p>
                  <input
                    className="report-redeem-input-inline"
                    type="text"
                    placeholder="请输入10位兑换码"
                    value={tier3RedeemCode}
                    onChange={(e) => setTier3RedeemCode(e.target.value.toUpperCase())}
                    maxLength={10}
                  />
                  {tier3Error && <p className="report-redeem-error">{tier3Error}</p>}
                </div>
                <div className="report-btn-row">
                  <button className="report-buy-btn" onClick={handleTier3Buy}>购买</button>
                  <button className="report-unlock-btn-alt" onClick={handleTier3Redeem} disabled={tier3Redeeming || !tier3RedeemCode.trim()}>
                    {tier3Redeeming ? '兑换中...' : '解锁'}
                  </button>
                </div>
              </div>
            ) : !tier3ShowQuestionnaire ? (
              <div className="report-unlock-prompt">
                <div className="report-exclusive-icon">✨</div>
                <p className="report-exclusive-text">你已拥有专属报告资格</p>
                {tier3PreviewLoading ? (
                  <p className="report-exclusive-hint">加载中...</p>
                ) : tier3PreviewText ? (
                  <div className="report-preview-section">
                    <p className="report-preview-label">专属报告包含</p>
                    <div className="report-preview-content" dangerouslySetInnerHTML={{ __html: tier3PreviewText }} />
                  </div>
                ) : null}
                <div className="report-btn-row">
                  <button className="report-unlock-btn" onClick={() => setTier3ShowQuestionnaire(true)}>使用 token 解锁</button>
                </div>
              </div>
            ) : !tier3Content && !tier3Generating ? (
              <div className="report-quiz">
                <div className="report-quiz-progress-wrap">
                  <div className="report-quiz-progress-bar-bg">
                    <div
                      className="report-quiz-progress-bar-fill"
                      style={{ width: ((tier3CurrentQuestionIndex) / TIER3_QUESTIONS.length) * 100 + '%' }}
                    />
                  </div>
                  <span className="report-quiz-progress-text">{tier3CurrentQuestionIndex + 1} / {TIER3_QUESTIONS.length}</span>
                </div>
                {tier3CurrentQuestionIndex > 0 && (
                  <button className="report-quiz-back-btn" onClick={handleTier3Back}>‹ 上一题</button>
                )}
                {(() => {
                  const q = TIER3_QUESTIONS[tier3CurrentQuestionIndex];
                  if (!q) return null;
                  const options = (tier3QuestionnaireOptions && tier3QuestionnaireOptions[q.key]) || TIER3_FALLBACK_OPTIONS[q.key] || [];
                  if (!options.length) return null;
                  return (
                    <div className="report-quiz-question-card" key={tier3CurrentQuestionIndex}>
                      <p className="report-quiz-question-title">{q.title}</p>
                      <div className="report-quiz-options">
                        {options.map((opt) => (
                          <button
                            key={opt}
                            className={[
                              'report-quiz-option',
                              tier3Answers[q.key] === opt ? 'report-quiz-option--active' : '',
                              tier3AnswerFlash === q.key ? 'report-quiz-option--flash' : '',
                            ].filter(Boolean).join(' ')}
                            onClick={() => handleTier3Answer(q.key, opt)}
                          >{opt}</button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {tier3Error && <p className="report-q-error">{tier3Error}</p>}
              </div>
            ) : tier3Generating ? (
              <div className="report-loading">
                <div className="report-loading-spinner" />
                <p>AI 正在根据你的偏好生成专属方案...</p>
              </div>
            ) : null}
          </div>
        )}

          </>
        )}

        {reportValid !== false && reportValid !== null && (
          showAd && <AdOverlay duration={AD_DURATION_SEC} onComplete={handleAdFinish} />
        )}
      </div>
          {openPhoto && (
            <div className="photo-lightbox-overlay" onClick={() => setOpenPhoto(null)}>
              <img className="photo-lightbox-img" src={openPhoto} alt="放大预览" />
            </div>
          )}
    </RequireAuth>
  );
}



