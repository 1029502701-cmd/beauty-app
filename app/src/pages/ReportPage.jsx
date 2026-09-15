import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import RequireAuth from '../router/RequireAuth.jsx';
import Tier2Result from './Tier2Result.jsx';
import { getCompliment } from './complimentMap.js';
import { BASE, pointsApi, UNLOCK_REPORT_AMOUNT } from '../api.js';
import { checkAndResize } from '../utils/imageResize.js';
// 统一 cookie 鉴权 fetch（同源 /api 自动带共享域 cookie；跨源带 credentials 转发）
async function fetchWithCookie(url, opts = {}) {
  return fetch(url, { credentials: 'include', ...opts });
}
function dataUrlToBlob(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = dataUrl.slice(commaIdx + 1);
  const mime = dataUrl.slice(5, commaIdx) || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
import { composeShareCard, shareImage, fetchInviteInfo } from '../utils/makeShareCard.js';
import { removeStorageItem, STORAGE_KEYS } from '../utils/storage.js';
import CapturePhotoUpload from './CapturePhotoUpload.jsx';
import Tier2PhotoUpload from './Tier2PhotoUpload.jsx';

const RESULT_ITEMS = [
  { key: 'faceShape',        label: '脸型',         icon: '◎' },
  { key: 'skinType',         label: '肤质',         icon: '◉' },
  { key: 'eyebrowShape',     label: '眉形',         icon: '❖', placeholder: '上传照片后生成' },
  { key: 'eyeShape',         label: '眼型',         icon: '◐', placeholder: '上传照片后生成' },
  { key: 'threeFiveRatio',   label: '三庭五眼',     icon: '☰', placeholder: '上传照片后生成' },
  { key: 'symmetry',         label: '五官对称度',   icon: '⚖', placeholder: '上传照片后生成' },
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
  timeCost:    ['5分钟极简', '15分钟日常', '30分钟以上精致']};

function navigateBack() {
  window.history.pushState({}, '', '/home');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function navigateToCapture() {
  window.history.pushState({}, '', '/capture');
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// 将 Unix 秒时间戳格式化为 YYYY-MM-DD（北京时间展示）
function formatExpireDate(tsSec) {
  if (!tsSec) return '';
  const d = new Date(tsSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

const T3_PROD_GROUP_LABELS = { base: '底妆', eyes: '眼妆', lips: '唇妆', cheeks: '腮红' };
const T3_SECTION_STEPS = [
  { key: 'advice',  label: '整体建议',     icon: '✦' },
  { key: 'style',   label: '风格与场景融合', icon: '🎯' },
  { key: 'steps',   label: '步骤指南',     icon: '📋' },
  { key: 'products',label: '高匹配用品',     icon: '💄' },
  { key: 'tips',    label: '贴心提示',     icon: '⚠' },
  { key: 'time',    label: '时间提醒',     icon: '⏱' },
  { key: 'influencer',label: '化妆达人匹配', icon: '👩' },
];


// ── 化妆达人匹配卡片 ──────────────────────────────────────────────────────────
// 调用 /api/influencers/match 获取与用户面部特征最匹配的化妆达人（Top2）
function InfluencerMatchCard() {
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState(null);
  const { token } = useContext(AuthContext);

  useEffect(() => {
    if (!token) { setError("未登录"); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithCookie(BASE + "/influencers/match", {
          }).catch;
        if (cancelled) return;
        const data = await res.json();
        if (!res.ok) { setError(data.message || "加载失败"); return; }
        setMatches(data.matches || []);
      } catch (e) {
        if (!cancelled) setError("网络异常，请重试");
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (error) {
    return (
      <div className="t3-card t3-card--influencer">
        <h2 className="t3-card-title">👩 化妆达人匹配</h2>
        <p className="t3-influencer-empty">{error}</p>
      </div>
    );
  }

  if (matches === null) {
    return (
      <div className="t3-card t3-card--influencer">
        <h2 className="t3-card-title">👩 化妆达人匹配</h2>
        <p className="t3-influencer-loading">正在为你匹配最合适的化妆达人…</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="t3-card t3-card--influencer">
        <h2 className="t3-card-title">👩 化妆达人匹配</h2>
        <p className="t3-influencer-empty">暂无匹配的化妆达人，更多达人入驻中，敬请期待</p>
      </div>
    );
  }

  return (
    <div className="t3-card t3-card--influencer">
      <h2 className="t3-card-title">👩 化妆达人匹配</h2>
      <div className="t3-influencer-list">
        {matches.map((inf) => (
          <div key={inf.id} className="t3-influencer-card">
            {inf.makeupPhotoUrl ? (
              <img src={inf.makeupPhotoUrl} alt={inf.nickname} className="t3-influencer-avatar" />
            ) : (
              <div className="t3-influencer-avatar t3-influencer-avatar--placeholder">
                {(inf.nickname || "达").charAt(0)}
              </div>
            )}
            <div className="t3-influencer-info">
              <span className="t3-influencer-name">
                {inf.nickname}
                {inf.score != null && (
                  <span className="t3-influencer-score">匹配度 {Math.round(inf.score * 100)}%</span>
                )}
              </span>
              {inf.bio && <span className="t3-influencer-bio">{inf.bio}</span>}
              {inf.platform && <span className="t3-influencer-platform">{inf.platform}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function Tier3Report({ content, onRefresh, onShare, shareLoading, shareDone, photoUrl, enrichPending, aiImageUrl, showAiImage }) {
  const { overallAdvice, stepByStep, productRecs, tips, timeWarning, styleNote } = content;

const hasProductRecs = (productRecs && typeof productRecs === 'object' && Object.values(productRecs).some((v) => Array.isArray(v) && v.length > 0)) || !!enrichPending;
  const [prodLayerOpen, setProdLayerOpen] = useState(false);

  const hasSteps = Array.isArray(stepByStep) && stepByStep.length > 0;
  const hasTips = Array.isArray(tips) && tips.length > 0;

  const activeSections = T3_SECTION_STEPS.filter((s) => {
    switch (s.key) {
      case 'advice':   return !!overallAdvice;
      case 'style':    return !!styleNote;
      case 'steps':    return hasSteps;
      case 'products': return hasProductRecs;
      case 'tips':     return hasTips;
      case 'time':     return !!timeWarning;
      case 'influencer': return true; // 始终展示
      default: return false;
    }
  });

  const doneRatio = activeSections.length / T3_SECTION_STEPS.length;
  const styleTag = styleNote ? (styleNote.match(/^[^，,。；;]+/) || [styleNote])[0] : '专属定制';

  return (
    <div className="t3-page">
      {/* 报告头部（进阶报告 hero 同款视觉） */}
      <div className="t3-hero">
        <div className="t3-hero-top">
          <div className="t3-hero-text-col">
            <div className="t3-hero-badge">✦ YOUR MAKEUP PLAN ✦</div>
            <h1 className="t3-hero-title">专属美妆方案</h1>
            <div className="t3-hero-subtitle">
              <span className="t3-hero-subtitle-tag">{styleTag || '为你定制'}</span>
              <span className="t3-hero-subtitle-dot">·</span>
              <span className="t3-hero-subtitle-scene">{content._scenario || '今日妆容'}</span>
            </div>
          </div>
          {photoUrl && (
            <div className="t3-hero-photo-wrap">
              <img className="t3-hero-photo" src={photoUrl} alt="报告照片" />
              <span className="t3-hero-photo-label">本次照片</span>
            </div>
          )}
        </div>
        {overallAdvice && (
          <div className="t3-hero-advice">
            <div className="t3-hero-advice-label">✦ 方案解读</div>
            <p className="t3-hero-advice-text">{overallAdvice}</p>
          </div>
        )}
        <div className="t3-progress">
          <div className="t3-progress-bg">
            <div className="t3-progress-fill" style={{ width: doneRatio * 100 + '%' }} />
          </div>
          <span className="t3-progress-label">{activeSections.length} 个模块已生成</span>
        </div>
      </div>

      {/* AI 妆效图模块（后台 tier3_show_ai_image 可隐藏） */}
      {showAiImage && aiImageUrl && (
        <div className="t3-card t3-card--ai-image">
          <h2 className="t3-card-title">🪞 AI 妆效参考</h2>
          <div className="t3-ai-image-wrap">
            <img className="t3-ai-image" src={aiImageUrl} alt="AI 妆效参考图" />
            <span className="t3-ai-image-hint">基于你的照片 + 本报告妆容风格生成，仅供参考</span>
          </div>
        </div>
      )}

      {/* 风格与场景融合 */}
      {styleNote && (
        <div className="t3-card t3-card--style">
          <h2 className="t3-card-title">🎯 风格与场景融合</h2>
          <p className="t3-card-text">{styleNote}</p>
        </div>
      )}

      {/* 步骤指南 */}
      {hasSteps && (
        <div className="t3-card">
          <h2 className="t3-card-title">📋 步骤指南</h2>
          <div className="t3-steps">
            {stepByStep.map((s, i) => (
              <div key={i} className="t3-step">
                <span className="t3-step-num">{String(s.step || i + 1).padStart(2, '0')}</span>
                <div className="t3-step-body">
                  <div className="t3-step-head">
                    <span className="t3-step-name">{s.title}</span>
                    <span className="t3-step-meta">
                      {s.timeEstimate ? <span className="t3-step-time">⏱ {s.timeEstimate}</span> : null}
                      {s.difficultyHint ? <span className="t3-step-diff">{s.difficultyHint}</span> : null}
                    </span>
                  </div>
                  <p className="t3-step-desc">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 推荐产品 */}
      {(hasProductRecs || enrichPending) && (
        <div className="t3-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="t3-card-title">💄 高匹配用品</h2>
            <button type="button" onClick={() => setProdLayerOpen((v) => !v)} style={{ border: 'none', background: '#fff7f0', color: '#c2452e', fontSize: 12, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
              {prodLayerOpen ? '收起 ▴' : '💡 查看推荐商品 ▾'}
            </button>
          </div>
          {prodLayerOpen ? (
            <div className="t3-products">
              {Object.entries(productRecs).map(([dim, recs]) => {
                if (!Array.isArray(recs) || recs.length === 0) { if (enrichPending) return <div key={dim} className="t3-prod-group"><span className="t3-prod-group-label">{T3_PROD_GROUP_LABELS[dim] || dim}</span><div className="t3-prod-pending">正在匹配中…</div></div>; return null; }
                return (
                  <div key={dim} className="t3-prod-group">
                    <span className="t3-prod-group-label">{T3_PROD_GROUP_LABELS[dim] || dim}</span>
                    <div className="t3-prod-list">
                      {recs.map((rec, j) => {
                        const name = typeof rec === 'string' ? rec : rec.name;
                        const reason = typeof rec === 'string' ? '' : rec.reason;
                        const enriched = !!(rec.itemUrl || rec.imageUrl || (rec.price != null && rec.price > 0));
                        return (
                          <div key={j} className="t3-prod-item">
                            {rec.imageUrl ? <img src={rec.imageUrl} alt={name} className="t3-prod-img" /> : <div className="t3-prod-img" style={{ background: '#f3ece7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#b6a8a0' }}>🛍</div>}
                            <div className="t3-prod-info">
                              <span className="t3-prod-name">{name}</span>
                              {reason ? <span className="t3-prod-reason">💡 {reason}</span> : null}
                              {enriched ? (
                                rec.price != null && rec.price > 0 ? <span className="t3-prod-price">💰 {rec.price} 元</span> : null
                              ) : (
                                <span style={{ fontSize: 12, color: '#b6a8a0', opacity: enrichPending ? 1 : 0.85 }}>{enrichPending ? '正在匹配中…' : '暂无匹配商品'}</span>
                              )}
                            </div>
                            {rec.itemUrl ? (
                              <a className="t3-prod-link" href={rec.itemUrl} target="_blank" rel="noopener noreferrer">淘宝查看 ↗</a>
                            ) : enrichPending ? null : <span style={{ fontSize: 12, color: '#c9b8ac' }}>—</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#8a7f76', margin: '8px 0 0' }}>点击「💡 查看推荐商品」展开为你匹配的高契合单品</p>
          )}
        </div>
      )}

      {/* 贴心提示 */}
      {hasTips && (
        <div className="t3-card t3-card--tips">
          <h2 className="t3-card-title">⚠ 贴心提示</h2>
          <ul className="t3-tips">
            {tips.map((t, i) => <li key={i} className="t3-tip">{t}</li>)}
          </ul>
        </div>
      )}

      {/* 化妆达人匹配 */}
      <InfluencerMatchCard />

      {/* 时间提醒 */}
      {timeWarning && (
        <div className="t3-time-warning">
          <span className="t3-time-warning-icon">⏱</span>
          <p className="t3-time-warning-text">{timeWarning}</p>
        </div>
      )}

      {/* 底部：重新生成 + 分享占位（对齐进阶报告 footer） */}
      <div className="t3-footer">
        <button className="t3-refresh-btn" onClick={onRefresh}>重新生成</button>
        <button className="t3-share-btn" onClick={onShare} disabled={shareLoading}>
          {shareDone ? '✓ 已生成分享图' : '分享报告'}
        </button>
      </div>
    </div>
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

  // Restore photo preview from R2 when tier1 report is loaded (key format: face-photos/{userId}/{reportId}.jpg)
  useEffect(() => {
    if (!reportId) return;
      /* 前端不再持有 token；照片预览改由本端接口按 reportId 解析当前用户（cookie 鉴权）*/
      setPreview('/api/r2-proxy?key=face-photos/latest/' + encodeURIComponent(reportId) + '.jpg&bucket=temp');
    }, [reportId]);
  const [openPhoto, setOpenPhoto] = useState(null);
  const [tier2Status, setTier2Status] = useState(null);
  const [tier2Content, setTier2Content] = useState(null);
  const [tier2LoadError, setTier2LoadError] = useState(null);
  const [tier2Generation, setTier2Generation] = useState(null);
  const [tier2Processing, setTier2Processing] = useState(false);
  const [tier2FacePhotoKey, setTier2FacePhotoKey] = useState(null);
  const [imgUnlockLoading, setImgUnlockLoading] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adMode, setAdMode] = useState('image'); // 'image'=AI妆效图解锁 'tier2'=进阶报告广告解锁
  const [imgResult, setImgResult] = useState(null);
  const [retryable, setRetryable] = useState(false);
  const unlockBusyRef = useRef(false);
  const shareCardRef = useRef(null);
  const qrCanvasRef = useRef(null);
  const shareUrlRef = useRef('');
  const [shareLoading, setShareLoading] = useState(false);
  const [shareDone, setShareDone] = useState(false);
  const [adUnlockLoading, setAdUnlockLoading] = useState(false);
  // 重新拍摄解锁：看广告消耗每日 1 次名额，解锁后展示照片上传
  const [redoUnlocked, setRedoUnlocked] = useState(false);
  const [redoTier2Id, setRedoTier2Id] = useState(null);
  const [shareDailyLimitExceeded, setShareDailyLimitExceeded] = useState(false);
  const [reportValid, setReportValid] = useState(null); // null = not checked yet
  const tier2TimerRef = useRef(null); // track polling interval to prevent multiple simultaneous timers
  const tier2StuckSinceRef = useRef(null); // 看门狗：processing 起始时间
  const tier2StuckRetriesRef = useRef(0); // 重新触发次数
  const [btnColor, setBtnColor] = useState("#000000");
  // Tier3 state（兑换码资格改由 tier3RedeemCodeUsed 承载，见下方声明）
  const [tier3QuestionnaireOptions, setTier3QuestionnaireOptions] = useState(null);
  const [tier3ShowQuestionnaire, setTier3ShowQuestionnaire] = useState(false);
  const [tier3Answers, setTier3Answers] = useState({});
  const tier3AnswersRef = useRef(tier3Answers);
  useEffect(() => { tier3AnswersRef.current = tier3Answers; }, [tier3Answers]);
  const [tier3Generating, setTier3Generating] = useState(false);
  const [tier3Content, setTier3Content] = useState(null);
  // 两步交互：报告生成完先收起，点“查看报告”才展开（二层=点灯泡才显示商品）
  const [tier3ReportViewOpen, setTier3ReportViewOpen] = useState(false);
  const [tier3ReportId, setTier3ReportId] = useState(null);
  const [tier3EnrichPending, setTier3EnrichPending] = useState(false);
  const tier3EnrichFiredRef = useRef(null); // 记录已触发 enrich-products 的报告 id，避免重复

  // 个人中心：最新一份专属（tier3）报告简要信息（专属页 scenario 回退等）
  const [myTier3, setMyTier3] = useState(null);
  const [myTier3Archives, setMyTier3Archives] = useState([]); // 个人中心：全部专属报告档案（每份独立，不互相覆盖）
  const [archiveOpenId, setArchiveOpenId] = useState(null); // 档案详情：当前展开的报告 id
  const [archiveDetail, setArchiveDetail] = useState(null); // 档案详情内容（按报告 id 懒加载）
  const [archiveDetailLoading, setArchiveDetailLoading] = useState(false);
  const [tier3Error, setTier3Error] = useState(null);
  const [tier3RedeemCode, setTier3RedeemCode] = useState('');
  const [tier3Redeeming, setTier3Redeeming] = useState(false);
  // 兑换码核销成功后，记住该码（code 本身），生成时传给 /tier3/generate 精确关联
  const [tier3RedeemCodeUsed, setTier3RedeemCodeUsed] = useState(null);
  const tier3RedeemCodeUsedRef = useRef(null);
  // 专属报告积分余额 / 扣减中标记
  const [tier3PointsBalance, setTier3PointsBalance] = useState(null);
  const [tier3PointsConsume, setTier3PointsConsume] = useState(false);
  // 是否已积分解锁专属报告（本端 tier3_points_unlock 持久化记录）；刷新/换设备后仍能恢复资格，
  // 比 tier3PointsGrantedRef 更可靠（后者只是当次会话内存态）
  const [tier3PointsUnlocked, setTier3PointsUnlocked] = useState(false);
  // 专属报告（tier3）照片上传：问卷完成 → 上传照片 → 开始生成
  const [tier3Photo, setTier3Photo] = useState(null);
  const [tier3PhotoKey, setTier3PhotoKey] = useState(null);
  const [tier3ContentPhotoUrl, setTier3ContentPhotoUrl] = useState(null); // 本次刚生成报告对应的照片预览 URL
  const [tier3AiImageUrl, setTier3AiImageUrl] = useState(null); // 本次报告 AI 妆效图
  const [tier3ShowAiImage, setTier3ShowAiImage] = useState(true); // 后台开关：是否显示 tier3 AI 妆效图模块
  useEffect(() => {
    fetchWithCookie(BASE + '/admin/config').then(r=>r.json()).then(d=>{
      const cfg = (d.configs||[]).find(c=>c.key==='tier3_show_ai_image');
      setTier3ShowAiImage(cfg ? cfg.value !== 'false' : true);
    }).catch(()=>{});
  }, []);
  const [tier3PhotoUploading, setTier3PhotoUploading] = useState(false);
  const [tier3PhotoError, setTier3PhotoError] = useState(null);
  const tier3PhotoInputRef = useRef(null);
  const tier3PhotoKeyRef = useRef(null);
const tier3PhotoKeyLiveRef = useRef(null);
  useEffect(() => { tier3PhotoKeyRef.current = tier3PhotoKey; tier3PhotoKeyLiveRef.current = tier3PhotoKey; }, [tier3PhotoKey]);
  const [tier3LoadError, setTier3LoadError] = useState(null);
  const [tier3PreviewText, setTier3PreviewText] = useState('');
  const [tier3PreviewLoading, setTier3PreviewLoading] = useState(true);
  const [tier3CurrentQuestionIndex, setTier3CurrentQuestionIndex] = useState(0);
  const [tier3AnswerFlash, setTier3AnswerFlash] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [reuploadTier1, setReuploadTier1] = useState(false);
  const tier3TimerRef = useRef(null);

  const handleReuploadTier1 = useCallback(() => {
    setReuploadTier1(true);
  }, []);

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
        const res = await fetchWithCookie(BASE + '/tier1/validate?id=' + encodeURIComponent(reportId), {
          }).catch;
        const data = await res.json();
        if (!cancelled) setReportValid(data.valid ?? false);
      } catch {
        if (!cancelled) setReportValid(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportId, token]);

  // 初识报告不存在/已失效：清除过期的报告指针，避免首页再次指向失效报告，
  // 让「初识」标签直接展示拍照上传页
  useEffect(() => {
    if (reportValid === false) {
      setPreview(null);
      try { sessionStorage.removeItem('capture_report_id'); } catch {}
    }
  }, [reportValid]);

  // Load tier2 generation status on mount
  // 进阶报告独立：没有初识报告（reportId 为空）也查询该用户最新的进阶报告
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = reportId ? '?tier1ReportId=' + encodeURIComponent(reportId) : '';
        const res = await fetchWithCookie(BASE + '/tier2/status' + qs);
        if (!res.ok) throw new Error('请求失败: ' + res.status);
        const data = await res.json();
        if (!cancelled) {
          setTier2Generation(data);
          setTier2Status(data);
          if (data.facePhotoKey) setTier2FacePhotoKey(data.facePhotoKey);
          if (data.generationStatus === 'ready' && data.content) {
            setTier2Content(data.content);
          }
          // pending + 关联初识报告（历史数据）：主动触发生成一次
          // 独立 pending（无初识关联）：等用户上传照片，不再自动触发，避免失败循环
          if (data.generationStatus === 'pending' && data.sourceTier1ReportId) {
            setTier2Generation({ ...data, generationStatus: 'processing' });
            setTier2Status({ ...data, generationStatus: 'processing' });
            fetchWithCookie(BASE + '/tier2/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reportId: data.tier2ReportId })
            }).catch(() => {});
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
  // 只依赖状态字符串（而非整个对象），避免每次轮询都重建定时器
  const tier2GenerationRef = useRef(tier2Generation);
  useEffect(() => { tier2GenerationRef.current = tier2Generation; }, [tier2Generation]);

  useEffect(() => {
    if (tier2Generation?.generationStatus !== 'processing') return;
    setTier2Processing(true);
    let aborted = false;
    const interval = setInterval(async () => {
      if (aborted) return;
      const gen = tier2GenerationRef.current;
      if (!gen?.tier2ReportId) return;
      try {
        const res = await fetchWithCookie(BASE + '/tier2/status?tier2Id=' + encodeURIComponent(gen.tier2ReportId), {
          });
        if (!res.ok) throw new Error('请求失败: ' + res.status);
        const data = await res.json();
        if (aborted) return;
        if (data.generationStatus === 'pending') {
          // pending：只有关联初识报告的历史数据才自动续生成；独立报告停止轮询，界面转为上传照片入口
          if (data.sourceTier1ReportId) {
            setTier2Generation({ ...data, generationStatus: 'processing' });
            setTier2Status({ ...data, generationStatus: 'processing' });
            fetchWithCookie(BASE + '/tier2/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reportId: data.tier2ReportId })
        }).catch(() => {});
          } else {
            setTier2Generation(data);
            setTier2Status(data);
            aborted = true;
            setTier2Processing(false);
            clearInterval(interval);
            tier2TimerRef.current = null;
          }
          return;
        }
        if (data.generationStatus === 'processing') {
          // 看门狗：卡 processing 超 4 分 40 秒（与服务端 5 分钟孤儿规则对齐）：
          // 关联初识的报告最多重新触发 3 次；独立报告无初识数据可生成，不再自动重触发，
          // 直接标记 failed，界面引导重新上传照片（杜绝"失败→重新生成→再失败"死循环）
          if (tier2StuckSinceRef.current === null) tier2StuckSinceRef.current = Date.now();
          if (Date.now() - tier2StuckSinceRef.current > 280000) {
            tier2StuckRetriesRef.current += 1;
            if (data.sourceTier1ReportId && tier2StuckRetriesRef.current <= 3) {
              tier2StuckSinceRef.current = Date.now();
              console.log('[ReportPage] tier2 stuck in processing, re-triggering generation, attempt ' + tier2StuckRetriesRef.current);
              fetchWithCookie(BASE + '/tier2/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportId: data.tier2ReportId })
        }).catch(() => {});
              return;
            }
            setTier2Generation({ ...data, generationStatus: 'failed' });
            setTier2Status({ ...data, generationStatus: 'failed' });
            aborted = true;
            setTier2Processing(false);
            clearInterval(interval);
            tier2TimerRef.current = null;
          }
          return;
        }
        tier2StuckSinceRef.current = null;
        tier2StuckRetriesRef.current = 0;
        setTier2Generation(data);
        setTier2Status(data);
        if (data.facePhotoKey) setTier2FacePhotoKey(data.facePhotoKey);
        if (data.content) setTier2Content(data.content);
        aborted = true;
        setTier2Processing(false);
        clearInterval(interval);
        tier2TimerRef.current = null;
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
  }, [reportId, token, tier2Generation?.generationStatus]);


  // Fetch tier2_btn_color from admin config on mount
  useEffect(() => {
    let cancelled = false;
    fetchWithCookie(BASE + '/config/tier2_btn_color')
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
      // 各请求独立兜底：任何接口失败都不置 loadError（否则整页白屏）
      if (cancelled) return;
      try {
        const optionsRes = await fetchWithCookie(BASE + '/tier3/questionnaire-options').catch(() => null);
        if (optionsRes && optionsRes.ok && !cancelled) {
          const optionsData = await optionsRes.json();
          setTier3QuestionnaireOptions(optionsData.options || {});
        }
      } catch { /* 忽略 */ }
      try {
        const previewRes = await fetchWithCookie(BASE + '/config/tier3_preview_text').catch(() => null);
        if (previewRes && previewRes.ok && !cancelled) {
          const previewData = await previewRes.json();
          setTier3PreviewText(previewData.value || '专属报告为你提供个性化深度分析，涵盖整体建议、步骤指南和推荐产品。');
        } else if (!cancelled) {
          setTier3PreviewText('专属报告为你提供个性化深度分析，涵盖整体建议、步骤指南和推荐产品。');
        }
      } catch { /* 忽略 */ }
      if (!cancelled) setTier3PreviewLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [activeTab, token]);

  // 专属报告解锁：查询积分余额 + 是否已积分解锁（本端 tier3_points_unlock 落库）。
  // 余额用于"消耗积分解锁"按钮可用性；pointsUnlocked 用于刷新/换设备后恢复"已解锁资格"，
  // 不再依赖当次会话的内存 ref，避免"已扣积分但状态丢失"。
  useEffect(() => {
    if (!token) return;
    if (activeTab !== '专属') return;
    let cancelled = false;
    pointsApi.getBalance().then((val) => {
      if (!cancelled) setTier3PointsBalance(val);
    }).catch(() => {
      if (!cancelled) setTier3PointsBalance(null);
    });
    pointsApi.getPointsUnlockStatus().then((st) => {
      if (cancelled) return;
      if (st.unlocked) {
        setTier3PointsUnlocked(true);
        tier3PointsGrantedRef.current = true;
      }
      if (typeof st.balance === 'number') setTier3PointsBalance(st.balance);
    }).catch(() => { /* 查询失败不阻断 */ });
    return () => { cancelled = true; };
  }, [activeTab, token]);
    // 兑换码核销成功（tier3RedeemCodeUsed 非空）时，自动进入定制问卷
    useEffect(() => {
      if (!token) return;
      if (activeTab !== '专属') return;
      if (tier3RedeemCodeUsed && !tier3ShowQuestionnaire && !tier3Content && !tier3PointsUnlocked) {
        setTier3ShowQuestionnaire(true);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tier3RedeemCodeUsed, token, activeTab]);

  // 个人中心：加载用户的全部专属（tier3）报告档案（纯新增：每生成一份都是一条独立档案，不互相覆盖）
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithCookie(BASE + '/tier3/content', { }).catch;
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.reports)) {
          setMyTier3Archives(data.reports);
          const latest = data.reports[0] || null;
          setMyTier3(latest ? { style: latest.style, scenario: latest.scenario, expireAt: latest.expireAt, id: latest.id, photoUrl: latest.photoUrl } : null);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [token, showArchive]);

  // 个人中心档案：点击某份专属报告 → 拉取该报告的完整内容（详情查看）
  useEffect(() => {
    if (!archiveOpenId || !token) return;
    let cancelled = false;
    setArchiveDetailLoading(true);
    setArchiveDetail(null);
    (async () => {
      try {
        const res = await fetchWithCookie(BASE + '/tier3/report-id?id=' + encodeURIComponent(archiveOpenId), { }).catch;
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setArchiveDetail(data);
        // Step 2：二层界面进入时按需补全淘宝商品（幂等；已补全则秒回，失败不影响报告主体）
        fetchWithCookie(BASE + '/tier3/enrich-products', { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify({ reportId: archiveOpenId }) })
          .then((r) => (r.ok ? r.json() : null))
          .then((en) => { if (!cancelled && en && en.productRecs) setArchiveDetail((prev) => (prev && prev.id === archiveOpenId ? { ...prev, content: { ...(prev.content || {}), productRecs: en.productRecs } } : prev)); })
          .catch(() => {});
      } catch {}
      if (!cancelled) setArchiveDetailLoading(false);
    })();
    return () => { cancelled = true; };
  }, [archiveOpenId, token]);
  const handleTier3Submit = useCallback(async () => {
    if (tier3Generating || !token) return;
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
      const res = await fetchWithCookie(BASE + '/tier3/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          tier1ReportId: reportId,
          questionnaireAnswers: tier3Answers,
          facePhotoKey: tier3PhotoKey || undefined,
          redeemCode: tier3RedeemCodeUsedRef.current || undefined})});
      const data = await res.json();
      if (res.ok && data.aiImageUrl) setTier3AiImageUrl(BASE + '/r2-proxy?key=' + encodeURIComponent(data.aiImageUrl) + '&bucket=temp');
      if (!res.ok) {
        if (res.status === 403 && data.error === 'no_redeem_code') {
          setTier3RedeemCodeUsed(null);
          tier3RedeemCodeUsedRef.current = null;
          setTier3Error('暂无解锁资格，请使用积分或兑换码解锁后重试');
        } else if (data.retryable) {
          setTier3Error('生成失败，未消耗资格，可重新尝试');
        } else {
          setTier3Error(data?.error || '请求失败 ' + res.status);
        }
      } else {
                // 若 AI 未给出具体商品名（productRecs 各维度为空），补一套默认品类骨架，
        // 保证二层「查看推荐商品」有内容可匹配；已命名则保持 AI 原样
        let finalContent = data.content || {};
        const recs = finalContent.productRecs;
        const isEmptyRecs = !recs || Object.keys(recs).length === 0 ||
          Object.values(recs).every((v) => !Array.isArray(v) || v.length === 0);
        if (isEmptyRecs) {
          finalContent = {
            ...finalContent,
            productRecs: {
              base: [{ name: "气垫粉底", reason: "轻薄持妆，通勤百搭" }],
              eyes: [{ name: "大地色眼影盘", reason: "自然提神" }, { name: "眼线胶笔", reason: "放大眼睛" }],
              lips: [{ name: "豆沙色唇釉", reason: "提升气色" }],
              cheeks: [{ name: "膏状腮红", reason: "自然红润" }]}};
        }
        setTier3Content(finalContent);

        // Step 2：报告主体已出，二层商品按需补全（幂等；失败不阻断展示）
        if (data.id) {
          fetchWithCookie(BASE + '/tier3/enrich-products', { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify({ reportId: data.id }) })
            .then((r) => (r.ok ? r.json() : null))
            .then((en) => { if (en && en.productRecs) setTier3Content((prev) => (prev ? { ...prev, productRecs: en.productRecs } : prev)); })
            .catch(() => {});
        }
        setTier3ContentPhotoUrl(tier3PhotoKeyLiveRef.current ? "/api/r2-proxy?key=" + encodeURIComponent(tier3PhotoKeyLiveRef.current) + "&bucket=temp" : null);
        // 兑换码已消耗，清掉 redeemCodeUsed（不可重复使用）
        setTier3RedeemCodeUsed(null);
        tier3RedeemCodeUsedRef.current = null;
      }
    } catch (e) {
      setTier3Error('生成超时或服务异常，请点下方按钮重试');
    } finally {
      setTier3Generating(false);
    }
  }, [reportId, tier3Generating, token]);
  // 消耗积分解锁：动作成功那一刻调本端 /api/points/consume（代理 auth-center，价格/去重服务端定），
  // 成功后：1) 强制刷新余额（治"积分不变"）；2) 把资格落库（本端 tier3_points_unlock，刷新不丢）；3) 进入问卷。
  // 真正生成走 /api/tier3/generate（fromPoints=true，不再重复扣积分）。
  const tier3PointsGrantedRef = useRef(false);
  const handleTier3UnlockByPoints = useCallback(async () => {
    if (tier3PointsConsume || !token || tier3PointsBalance == null || tier3PointsBalance < UNLOCK_REPORT_AMOUNT) return;
    setTier3PointsConsume(true);
    setTier3Error(null);
    try {
      // 价格由服务端写死（UNLOCK_REPORT_AMOUNT），前端只传 reportId；once 去重保证一人一次。
      // reportId 为空时用稳定占位 tier3_default，保证同一用户对"默认"报告也一人一次。
      const ref = reportId || 'tier3_default';
      const result = await pointsApi.unlockReport(ref);
      if (result.consumed || (result.reason && /已解锁|已扣过/.test(result.reason))) {
        // 扣成功 或 之前已扣过（一人一次去重）→ 都视为具备资格
        tier3PointsGrantedRef.current = true;
        setTier3PointsUnlocked(true);
        // 强制刷新余额：以服务端最新值为准（先尝试接口回传，再兜底重新拉一次），修"积分不变"
        try {
          const fresh = await pointsApi.getBalance();
          setTier3PointsBalance(typeof fresh === 'number' ? fresh : result.balance);
        } catch {
          if (result.balance != null) setTier3PointsBalance(result.balance);
        }
        // 资格落库（幂等），刷新/换设备后仍能恢复；失败不阻断
        try { await pointsApi.recordPointsUnlock(ref); } catch { /* 忽略 */ }
        setTier3ShowQuestionnaire(true);
        setTier3Error(null);
      } else {
        if (result.balance != null) setTier3PointsBalance(result.balance);
        setTier3Error(result.reason || '积分不足或扣减失败，请重试');
      }
    } catch {
      setTier3Error('积分扣减失败，请重试');
    } finally {
      setTier3PointsConsume(false);
    }
  }, [tier3PointsConsume, token, tier3PointsBalance, reportId]);

  // 专属报告照片选择（拍照/相册/文件）
  const handleTier3PhotoPickCamera = async () => {
    try {
      setTier3PhotoError(null);
      const { Camera, CameraSource } = await import('@capacitor/camera');
      const r = await Camera.getPhoto({ quality: 85, allowEditing: false, resultType: 1, source: CameraSource.Camera });
      setTier3Photo(r.dataUrl);
    } catch {
      tier3PhotoInputRef.current?.click();
    }
  };
  const handleTier3PhotoPickGallery = async () => {
    try {
      setTier3PhotoError(null);
      const { Camera, CameraSource } = await import('@capacitor/camera');
      const r = await Camera.getPhoto({ quality: 85, allowEditing: false, resultType: 1, source: CameraSource.Photos });
      setTier3Photo(r.dataUrl);
    } catch {
      tier3PhotoInputRef.current?.click();
    }
  };
  const handleTier3PhotoInputChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setTier3PhotoError(null);
      const dataUrl = await checkAndResize(file);
      setTier3Photo(dataUrl);
    } catch {
      setTier3PhotoError('照片处理失败，请换一张试试');
    }
  };
  const handleTier3PhotoSubmit = async () => {
    if (!tier3Photo || tier3PhotoUploading || !token) return;
    setTier3PhotoUploading(true);
    setTier3PhotoError(null);
    try {
      const blob = dataUrlToBlob(tier3Photo);
      const form = new FormData();
      form.append('photo', blob, 'tier3-photo.jpg');
      const res = await fetchWithCookie(BASE + '/tier3/upload-photo', {
        method: 'POST',
        
        body: form});
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTier3PhotoError(json?.error || '照片上传失败，请重试');
        return;
      }
      const newKey = json.tier3FacePhotoKey || null;
      tier3PhotoKeyLiveRef.current = newKey;
      setTier3PhotoKey(newKey);
      setTier3Photo(null);
      // 照片上传成功 → 开始分析生成
      void handleTier3DoSubmit();
    } catch {
      setTier3PhotoError('网络异常，请重试');
    } finally {
      setTier3PhotoUploading(false);
    }
  };

  const handleTier3Back = useCallback(() => {
    setTier3CurrentQuestionIndex((prev) => Math.max(0, prev - 1));
  }, []);
  const handleTier3DoSubmit = useCallback(async () => {
    // 新一轮生成：收起已展开的报告，重置报告 id 与补全状态
    setTier3ReportViewOpen(false);
    setTier3ReportId(null);
    setTier3EnrichPending(false);
    tier3EnrichFiredRef.current = null;
    if (tier3Generating || !token) {
        return;
    }
    const dims = ['makeupStyle', 'scenario', 'skillLevel', 'timeCost'];
    const currentAnswers = tier3AnswersRef.current;
    const missing = dims.filter((d) => !currentAnswers[d]);
    if (missing.length > 0) {
      setTier3Error('请选择所有选项');
        return;
    }
    const livePhotoKey = tier3PhotoKeyLiveRef.current ?? tier3PhotoKeyRef.current;
    if (!livePhotoKey) {
      setTier3Error('请先上传照片');
      return;
    }
    // 解锁资格检查：兑换码核销成功（tier3RedeemCodeUsedRef 非空）或积分解锁（tier3PointsGranted/tier3PointsUnlocked）
    const hasReedemCode = !!tier3RedeemCodeUsedRef.current;
    if (!hasReedemCode && !tier3PointsGrantedRef.current && !tier3PointsUnlocked) {
      setTier3Error('暂无解锁资格，请使用积分或兑换码解锁后重试');
      return;
    }
    setTier3Generating(true);
    setTier3Error(null);
    setTier3Content(null);
    try {
      // 兑换码路径不传 fromPoints；积分路径传 fromPoints=true
      const usePoints = !hasReedemCode && (tier3PointsGrantedRef.current || tier3PointsUnlocked);
      const res = await fetchWithCookie(BASE + '/tier3/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          tier1ReportId: reportId,
          questionnaireAnswers: tier3AnswersRef.current,
          fromPoints: usePoints || undefined,
          redeemCode: tier3RedeemCodeUsedRef.current || undefined,
          facePhotoKey: livePhotoKey || undefined})});
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403 && (data.error === 'no_redeem_code' || data.error === 'redeem_code_used')) {
          setTier3RedeemCodeUsed(null);
          tier3RedeemCodeUsedRef.current = null;
          setTier3Error('暂无解锁资格，请使用积分或兑换码解锁后重试');
        } else if (data.retryable) {
          setTier3Error('生成失败，未消耗资格，可重新尝试');
        } else {
          setTier3Error(data?.error || '请求失败 ' + res.status);
        }
      } else {
        // 若 AI 未给出具体商品名（productRecs 各维度为空），补一套默认品类骨架，
        // 保证二层「查看推荐商品」有内容可匹配；已命名则保持 AI 原样
        let finalContent = data.content || {};
        const recs = finalContent.productRecs;
        const isEmptyRecs = !recs || Object.keys(recs).length === 0 ||
          Object.values(recs).every((v) => !Array.isArray(v) || v.length === 0);
        if (isEmptyRecs) {
          finalContent = {
            ...finalContent,
            productRecs: {
              base: [{ name: "气垫粉底", reason: "轻薄持妆，通勤百搭" }],
              eyes: [{ name: "大地色眼影盘", reason: "自然提神" }, { name: "眼线胶笔", reason: "放大眼睛" }],
              lips: [{ name: "豆沙色唇釉", reason: "提升气色" }],
              cheeks: [{ name: "膏状腮红", reason: "自然红润" }]}};
        }
        setTier3Content(finalContent);
        setTier3ContentPhotoUrl(tier3PhotoKeyLiveRef.current ? "/api/r2-proxy?key=" + encodeURIComponent(tier3PhotoKeyLiveRef.current) + "&bucket=temp" : null);
        // 记住报告 id + 收起“查看报告”态；生成完立即后台补全淘宝商品（点灯泡时有数据，不卡）
        setTier3ReportId(data.id || null);
        setTier3ReportViewOpen(false);
        // 兑换码已消耗，清掉 redeemCodeId（不可重复使用）
        setTier3RedeemCodeUsed(null);
        tier3RedeemCodeUsedRef.current = null;
        if (data.id && tier3EnrichFiredRef.current !== data.id) {
          tier3EnrichFiredRef.current = data.id;
          setTier3EnrichPending(true);
          fetchWithCookie(BASE + '/tier3/enrich-products', { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify({ reportId: data.id }) })
            .then((r) => (r.ok ? r.json() : null))
            .then((en) => { if (en && en.productRecs) setTier3Content((prev) => (prev ? { ...prev, productRecs: en.productRecs } : prev)); })
            .catch(() => {})
            .finally(() => setTier3EnrichPending(false));
        }
        // 本次生成已消耗资格（积分/兑换码各扣各的），清掉内存态；
        // tier3PointsUnlocked 保留 true：本报告的积分解锁资格已落库，刷新后仍显示"已解锁"。
        tier3PointsGrantedRef.current = false;
        // 兑换码已消耗，清掉 redeemCodeId（不可重复使用）
        setTier3RedeemCodeUsed(null);
        tier3RedeemCodeUsedRef.current = null;
        // 生成成功后回传的最新余额（本端 generate 已 proxy 读 auth-center），刷新"扣完积分"数字
        if (typeof data.balance === 'number') setTier3PointsBalance(data.balance);
      }
    } catch (e) {
        setTier3Error('生成超时或服务异常，请点下方按钮重试');
    } finally {
      setTier3Generating(false);
    }
  }, [reportId, tier3Generating, tier3Answers, token]);

  const handleTier3Answer = useCallback((dimension, value) => {
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
                // 问卷全部完成 → 进入照片上传步骤（不再直接生成）
        } else {
                return next;
        }
        return prev;
      });
    }, 320);
  }, [handleTier3DoSubmit, tier3CurrentQuestionIndex]);

  // 专属报告解锁：token 购买入口已废弃，「购买」改为跳转中枢购买积分页
  const handleTier3Buy = useCallback(() => {
    window.location.href = window.location.origin + '/?redirect=' + encodeURIComponent(window.location.href);
  }, []);

  const handleTier3Redeem = useCallback(async () => {
    if (!tier3RedeemCode.trim() || tier3Redeeming || !token) return;
    setTier3Redeeming(true);
    setTier3Error(null);
    try {
      const res = await fetchWithCookie(BASE + '/tier3/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ code: tier3RedeemCode.trim() })});
      const data = await res.json();
      if (res.ok && data.success) {
        // 记住核销成功的码（code 本身），生成时传给 /tier3/generate 的 redeemCode 字段
        const usedCode = data.redeemCode || tier3RedeemCode.trim();
        setTier3RedeemCodeUsed(usedCode);
        tier3RedeemCodeUsedRef.current = usedCode;
        setTier3RedeemCode('');
        // 兑换码核销成功 → 直接进入定制问卷
        setTier3ShowQuestionnaire(true);
        setTier3Error(null);
      } else {
        setTier3Error(data.message || '兑换失败');
      }
    } catch { setTier3Error('网络异常，请重试'); }
    finally { setTier3Redeeming(false); }
  }, [tier3RedeemCode, tier3Redeeming, token]);

  // 点“查看报告”：展开二层报告 + 若尚未触发则立即补全淘宝商品（兜底：正在匹配中…）
  const handleTier3ViewReport = useCallback(() => {
    setTier3ReportViewOpen(true);
    if (tier3ReportId && tier3EnrichFiredRef.current !== tier3ReportId) {
      tier3EnrichFiredRef.current = tier3ReportId;
      setTier3EnrichPending(true);
      fetchWithCookie(BASE + '/tier3/enrich-products', { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify({ reportId: tier3ReportId }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((en) => { if (en && en.productRecs) setTier3Content((prev) => (prev ? { ...prev, productRecs: en.productRecs } : prev)); })
        .catch(() => {})
        .finally(() => setTier3EnrichPending(false));
    }
  }, [tier3ReportId, token]);

  const handleTier3Refresh = useCallback(() => {
    setTier3Content(null);
    setTier3Error(null);
    setTier3Answers({});
    setTier3ShowQuestionnaire(false);
    // 重置为未解锁状态：界面回到积分/兑换码解锁引导页
    setTier3PointsUnlocked(false);
    tier3PointsGrantedRef.current = false;
    setTier3RedeemCodeUsed(null);
    tier3RedeemCodeUsedRef.current = null;
  }, []);

  // 专属报告分享：复用用户上传的美妆分享模板，把二维码换成当前报告链接
  const handleShareTier3 = useCallback(async () => {
    if (shareLoading) return;
    try {
      const [invite] = await Promise.all([
        fetchInviteInfo(token),
      ]);
      const inviteCode = invite?.inviteCode || '';
      // 优先用报告链接，其次用注册邀请链接
      const shareUrl = reportId
        ? BASE + '/report?id=' + encodeURIComponent(reportId)
        : (inviteCode ? window.location.origin + '/register?invite=' + encodeURIComponent(inviteCode) : window.location.href);
      // composeShareCard 内部用固定邀请注册链接；这里需要专属报告链接，手动合成
      const QRCode = await import('qrcode');
      const qr = document.createElement('canvas');
      await QRCode.toCanvas(qr, shareUrl, { width: 200, margin: 1, color: { dark: '#2d2d2d', light: '#ffffff' } });
      const loadTpl = (u) => new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error('tpl load fail ' + u));
        im.crossOrigin = 'anonymous';
        im.src = u;
      });
      const candUrls = ['/share-card-template.jpg'];
      
      let tpl; let lastErr;
      for (const u of candUrls) {
        try { tpl = await loadTpl(u); break; } catch (e) { lastErr = e; }
      }
      if (!tpl) throw lastErr || new Error('模板图加载失败');
      const c = document.createElement('canvas');
      c.width = tpl.naturalWidth; c.height = tpl.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(tpl, 0, 0, c.width, c.height);
      const QR_SIZE = 180, QR_X = 516 - QR_SIZE / 2, QR_Y = 1340 - QR_SIZE / 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(QR_X - 8, QR_Y - 8, QR_SIZE + 16, QR_SIZE + 16);
      ctx.drawImage(qr, QR_X, QR_Y, QR_SIZE, QR_SIZE);
      const blob = await new Promise((res, rej) => c.toBlob((b) => b ? res(b) : rej(new Error('合成失败')), 'image/png', 1.0));
      setShareDone(true);
      await shareImage(blob);
    } catch (e) {
      console.error('[ReportPage] tier3 分享异常:', e);
    } finally {
      setShareLoading(false);
    }
  }, [shareLoading, reportId, token]);

  const handleShareReport = useCallback(async () => {
    if (shareLoading || !reportId) return;
    setShareLoading(true);
    setShareDone(false);
    try {
      const res = await fetchWithCookie(BASE + '/tier1/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId })});
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
        width: 160, margin: 1, color: { dark: '#2d2d2d', light: '#ffffff' }});
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
    } catch (err) { console.error('[ReportPage] 分享异常:', err); }
    finally { setShareLoading(false); }
  }, [shareLoading, reportId, token]);

  const handleUnlockImage = useCallback(() => {
    if (!reportId || imgUnlockLoading || unlockBusyRef.current) return;
    setAdMode('image'); setShowAd(true); setImgResult(null); setRetryable(false);
    unlockBusyRef.current = true;
  }, [reportId, imgUnlockLoading]);

  const handleAdFinish = useCallback(async () => {
    setShowAd(false); setImgUnlockLoading(true);
    try {
      const res = await fetchWithCookie(BASE + '/tier2/unlock-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: tier2Status?.tier2ReportId || reportId })});
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
    setAdMode('image'); setShowAd(true); setImgResult(null); setRetryable(false);
    unlockBusyRef.current = true;
  }, [reportId]);


  // --- 广告解锁进阶报告（独立报告，不依赖初识，仅消耗每日限额）：先播放广告，结束后调解锁接口，再上传照片生成 ---
  const handleStartTier2AdUnlock = useCallback(() => {
    if (adUnlockLoading || unlockBusyRef.current) return;
    setAdMode('tier2');
    setShowAd(true);
    unlockBusyRef.current = true;
  }, [adUnlockLoading]);

  // 分析期间并行的广告：播完即关，不触发后端（报告由轮询驱动，次数在分析成功完成后由后端计入）
  const handleAdFinishForTier2Gen = useCallback(() => {
    setShowAd(false);
  }, []);

  const handleAdFinishForTier2 = useCallback(async () => {
    setShowAd(false);
    setAdUnlockLoading(true);
    try {
      const res = await fetchWithCookie(BASE + '/tier2/unlock-by-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({})});
      const data = await res.json();
      if (!res.ok || data?.error === 'daily_limit_exceeded') {
        if (data?.error === 'daily_limit_exceeded') {
          alert(data.message || '今日进阶报告次数已用完，明天再来吧');
        }
        return;
      }
      // 解锁成功：独立报告进入 pending，界面展示照片上传入口（上传后开始生成与轮询）
      setTier2Generation({ generationStatus: 'pending', tier2ReportId: data.tier2ReportId, sourceTier1ReportId: null, unlocked: true });
      setTier2Status({ generationStatus: 'pending', tier2ReportId: data.tier2ReportId, sourceTier1ReportId: null, unlocked: true });
    } finally {
      setAdUnlockLoading(false);
      unlockBusyRef.current = false;
    }
  }, [token]);

  // --- 重新拍摄解锁：看广告消耗每日 1 次名额（复用 /tier2/unlock-by-ad），解锁后展示照片上传 ---
  const handleStartRedoAdUnlock = useCallback(() => {
    if (adUnlockLoading || unlockBusyRef.current) return;
    setAdMode('tier2redo');
    setShowAd(true);
    unlockBusyRef.current = true;
  }, [adUnlockLoading]);

  const handleAdFinishForTier2Redo = useCallback(async () => {
    setShowAd(false);
    setAdUnlockLoading(true);
    try {
      const res = await fetchWithCookie(BASE + '/tier2/unlock-by-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({})});
      const data = await res.json();
      if (!res.ok || data?.error === 'daily_limit_exceeded') {
        if (data?.error === 'daily_limit_exceeded') {
          alert(data.message || '今日进阶报告次数已用完，明天再来吧');
        }
        return;
      }
      // 解锁成功：展示重新拍摄上传入口（复用当前报告记录生成）
      setRedoTier2Id(data.tier2ReportId);
      setRedoUnlocked(true);
    } finally {
      setAdUnlockLoading(false);
      unlockBusyRef.current = false;
    }
  }, [token]);

  // --- 独立报告照片提交成功：进入生成中，开始轮询 ---
  const handleTier2PhotoStarted = useCallback((t2Id) => {
    if (!t2Id) return;
    tier2StuckSinceRef.current = null;
    tier2StuckRetriesRef.current = 0;
    setTier2Content(null);
    setTier2Generation((prev) => ({ ...(prev || {}), generationStatus: 'processing', tier2ReportId: t2Id }));
    setTier2Status((prev) => ({ ...(prev || {}), generationStatus: 'processing', tier2ReportId: t2Id }));
    // 分析期间并行播放广告：广告与 AI 生成同时进行；广告结束若报告未出则停留在"生成中"兜底动画
    setAdMode('tier2gen');
    setShowAd(true);
    setRedoUnlocked(false);
  }, []);

  // --- 生成失败后重新生成（仅限关联初识报告的历史数据；不消耗广告解锁次数）
  // 独立报告走"重新上传照片"入口，不在此处触发，避免无数据空生成 ---
  const handleRetryTier2Generate = useCallback(() => {
    const gen = tier2GenerationRef.current;
    if (!gen?.tier2ReportId || !gen.sourceTier1ReportId) return;
    tier2StuckSinceRef.current = null;
    tier2StuckRetriesRef.current = 0;
    setTier2Generation({ ...gen, generationStatus: 'processing' });
    setTier2Status({ ...gen, generationStatus: 'processing' });
    fetchWithCookie(BASE + '/tier2/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({ reportId: gen.tier2ReportId })}).catch(() => {});
  }, [token]);


  const initReport = tier1Report;
  const resolvedResults = RESULT_ITEMS.map((item) => {
    const value = initReport?.[item.key] ?? item.placeholder;
    const compliment = getCompliment(item.key, value);
    return { ...item, value, compliment };
  });
  const personaTags = initReport?.personaTags ? [initReport.personaTags] : ['温柔知性风，适合日常淡妆', '清透裸妆感，凸显自然美'];
  const highlightText = initReport?.highlight ?? '你的五官比例协调，笑起来很有感染力';

  const t2 = tier2Content;
  const tier2FacePhotoUrl = tier2FacePhotoKey ? '/api/r2-proxy?key=' + encodeURIComponent(tier2FacePhotoKey) + '&bucket=temp' : null;

  // 个人中心专属报告到期预警：到期时间 <= 5 天时标红
  const tier3ExpireMs = myTier3?.expireAt ? myTier3.expireAt * 1000 : null;
  const expiringSoon = tier3ExpireMs ? (tier3ExpireMs - Date.now()) <= 5 * 24 * 60 * 60 * 1000 : false;

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

        <div className="report-header">
          <button className="report-back-btn" onClick={navigateBack}>‹ 返回</button>
          <span className="report-title">美妆分析报告</span>
          <button className="report-archive-btn" onClick={() => setShowArchive(true)}>个人中心</button>
        </div>

        <div className="report-tabs">
          {['初识', '进阶', '专属'].map((tab) => (
            <button key={tab} className={'report-tab' + (activeTab === tab ? ' report-tab--active' : '')} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>

        {/* 初识 */}
        {activeTab === '初识' && (
          <div className="report-tab-content">
            {reportValid === null && reportId ? (
              <div className="report-loading">正在验证报告...</div>
            ) : reportValid === false || !initReport ? (
              <>
                <CapturePhotoUpload
                  preview={preview}
                  compact
                  onComplete={(rid, reportData, previewData) => {
                    setTier1Report(reportData);
                    setPreview(previewData || null);
                    window.history.pushState({ reportId: rid, preview: previewData }, "", "/report?id=" + encodeURIComponent(rid));
                    window.dispatchEvent(new PopStateEvent("popstate"));
                  }}
                />
                <button className="capture-influencer-btn" onClick={() => window.location.href="/influencer-apply"} title="达人入驻">✨ 达人入驻</button>
              </>
            ) : (
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
                {reuploadTier1 ? (
                  <>
                    <div className="report-reupload-section">
                      <p className="report-reupload-hint">重新上传照片后，将基于新照片生成新的初识报告</p>
                      <button className="report-reupload-btn" onClick={() => setReuploadTier1(false)}>← 返回查看当前报告</button>
                    </div>
                    <CapturePhotoUpload
                      preview={preview}
                      compact
                      onComplete={(rid, reportData, previewData) => {
                        setTier1Report(reportData);
                        setPreview(previewData || null);
                        setReuploadTier1(false);
                        window.history.pushState({ reportId: rid, preview: previewData }, "", "/report?id=" + encodeURIComponent(rid));
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      }}
                    />
                  </>
                ) : (
                  <div className="report-reupload-section">
                    <button className="report-reupload-btn" onClick={handleReuploadTier1}>🔄 重新上传照片</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 进阶 */}
        {activeTab === '进阶' && (
          <div className="report-tab-content">
            {tier2Content ? (
              <>
                <Tier2Result content={tier2Content} isMock={!tier2Content} btnStyle={{background: btnColor}} onUnlockImage={handleAdFinish} facePhotoUrl={tier2FacePhotoUrl} />
                <div className="report-redo-upload">
                  <div className="report-unlock-prompt">
                    <div className="report-unlock-icon">🔄</div>
                    <p className="report-unlock-text">重新拍摄生成进阶报告</p>
                    <p className="report-unlock-hint">分析期间可看广告；生成失败不扣次数</p>
                    {tier2Generation?.tier2ReportId ? (
                      <Tier2PhotoUpload
                        compact
                        tier2ReportId={tier2Generation.tier2ReportId}
                        onStarted={handleTier2PhotoStarted}
                        title="请上传一张清晰的正面照片"
                      />
                    ) : null}
                  </div>
                </div>
              </>
            ) : tier2Generation?.generationStatus === 'processing' ? (
              <div className="report-loading">
                <div className="t2-spinner" />
                <p>AI 正在生成进阶报告（约 2-4 分钟），请稍候…</p>
              </div>
            ) : tier2Generation?.generationStatus === 'failed' ? (
              <div className="report-unlock-prompt">
                <div className="report-unlock-icon">⚠️</div>
                <p className="report-unlock-text">进阶报告生成失败</p>
                <p className="report-unlock-hint">失败不扣次数，重新上传照片即可再次生成</p>
                {tier2Generation?.tier2ReportId ? (
                  <Tier2PhotoUpload
                    compact
                    tier2ReportId={tier2Generation.tier2ReportId}
                    onStarted={handleTier2PhotoStarted}
                    title="重新上传照片"
                  />
                ) : (
                  <Tier2PhotoUpload
                    compact
                    onStarted={handleTier2PhotoStarted}
                    title="请上传一张清晰的正面照片"
                  />
                )}
              </div>
            ) : tier2Generation?.canGenerate === false ? (
              <div className="report-unlock-prompt">
                <div className="report-unlock-icon">🔒</div>
                <p className="report-unlock-text">今日进阶报告次数已用完</p>
                <p className="report-unlock-hint">每天 1 次，明天再来吧</p>
              </div>
            ) : (
              <div className="report-unlock-prompt">
                <div className="report-unlock-icon">📷</div>
                <p className="report-unlock-text">上传照片生成进阶报告</p>
                <Tier2PhotoUpload
                  compact
                  tier2ReportId={tier2Generation?.generationStatus === 'pending' ? tier2Generation?.tier2ReportId : undefined}
                  onStarted={handleTier2PhotoStarted}
                  title="请上传一张清晰的正面照片"
                />
                <p className="report-unlock-hint">进阶报告独立生成，无需先完成初识报告；分析期间可看广告</p>
              </div>
            )}
          </div>
        )}

        {activeTab === '专属' && (
          <div className="report-tab-content">
            {tier3LoadError && <div className="report-error"><p>{tier3LoadError}</p><button onClick={() => { setTier3LoadError(null); }}>重试</button></div>}
            {tier3PreviewLoading ? (
              <div className="report-loading">加载中...</div>
            ) : tier3Content ? (
              tier3ReportViewOpen ? (
                <Tier3Report
                photoUrl={tier3ContentPhotoUrl || (myTier3 && myTier3.photoUrl)}
                aiImageUrl={tier3AiImageUrl}
                showAiImage={tier3ShowAiImage}
                content={{ ...tier3Content, _scenario: tier3Answers.scenario || (myTier3 && myTier3.scenario) || '今日妆容' }}
                onRefresh={handleTier3Refresh}
                onShare={handleShareTier3}
                shareLoading={shareLoading}
                shareDone={shareDone}
                enrichPending={tier3EnrichPending}
              />
              ) : (
                <div className="t3-view-report-wrap" style={{ textAlign: 'center', padding: '24px 16px' }}>
                  <p style={{ color: '#8a7f76', fontSize: 14, marginBottom: 16 }}>你的专属方案已生成 ✓</p>
                  <button className="t3-cta-btn" onClick={handleTier3ViewReport} style={{ width: '100%', maxWidth: 280, margin: '0 auto', display: 'block' }}>📄 查看报告</button>
                  {tier3EnrichPending ? <p style={{ color: '#b6a8a0', fontSize: 12, marginTop: 12 }}>正在匹配商品…</p> : null}
                </div>
              )
            ) : !tier3ShowQuestionnaire ? (
              <div className="t3-unlock">
                <div className="t3-unlock-hero">
                  <div className="t3-unlock-badge">✦ PREMIUM REPORT ✦</div>
                  <h1 className="t3-unlock-title">专属深度美妆方案</h1>
                  <p className="t3-unlock-sub">AI 根据你的脸型、肤质与偏好，为你定制可落地的妆容步骤与产品清单</p>
                  {tier3PreviewLoading ? (
                    <p className="t3-unlock-hint">报告说明加载中...</p>
                  ) : tier3PreviewText ? (
                    <div className="t3-unlock-preview" dangerouslySetInnerHTML={{ __html: tier3PreviewText }} />
                  ) : null}
                </div>
                <div className="t3-unlock-tiles">
                  <button
                    className="t3-unlock-tile t3-unlock-tile--primary"
                    onClick={handleTier3Buy}
                  >
                    <span className="t3-unlock-tile-icon">💳</span>
                    <span className="t3-unlock-tile-label">购买积分解锁</span>
                    <span className="t3-unlock-tile-sub">前往中枢购买积分</span>
                  </button>
                  <button
                    className="t3-unlock-tile"
                    onClick={handleTier3UnlockByPoints}
                    disabled={tier3PointsUnlocked || tier3PointsConsume || tier3PointsBalance === null || tier3PointsBalance < UNLOCK_REPORT_AMOUNT}
                  >
                    <span className="t3-unlock-tile-icon">⭐</span>
                    <span className="t3-unlock-tile-label">
                      {tier3PointsUnlocked ? '已解锁（本次已扣 ' + UNLOCK_REPORT_AMOUNT + ' 积分）' : tier3PointsConsume ? '扣减中…' : tier3PointsBalance === null ? '积分加载中…' : tier3PointsBalance < UNLOCK_REPORT_AMOUNT ? '积分不足' : UNLOCK_REPORT_AMOUNT + ' 积分解锁'}
                    </span>
                    {tier3PointsBalance !== null && <span className="t3-unlock-tile-sub">当前余额 {tier3PointsBalance} 积分</span>}
                  </button>
                </div>
                <div className="t3-unlock-redeem">
                  <p className="t3-unlock-redeem-label">已有兑换码</p>
                  <div className="t3-unlock-redeem-row">
                    <input
                      className="t3-unlock-redeem-input"
                      type="text"
                      placeholder="输入10位兑换码"
                      value={tier3RedeemCode}
                      onChange={(e) => setTier3RedeemCode(e.target.value.toUpperCase())}
                      maxLength={10}
                    />
                    <button
                      className="t3-unlock-redeem-btn"
                      onClick={handleTier3Redeem}
                      disabled={tier3Redeeming || !tier3RedeemCode.trim()}
                    >
                      {tier3Redeeming ? '兑换中...' : '解锁'}
                    </button>
                  </div>
                  {tier3Error && <p className="report-q-error">{tier3Error}</p>}
                </div>
              </div>
            ) : !tier3ShowQuestionnaire ? (
              <div className="t3-unlock t3-unlock--ready">
                <div className="t3-unlock-hero">
                  <div className="t3-unlock-badge">✦ READY ✦</div>
                  <h1 className="t3-unlock-title">你已拥有专属报告资格</h1>
                  <p className="t3-unlock-sub">完成 4 道偏好问卷 + 上传一张照片，AI 即刻为你生成专属方案</p>
                </div>
                <button className="t3-cta-btn" onClick={() => setTier3ShowQuestionnaire(true)}>开始定制 →</button>
              </div>
            ) : !tier3Content && !tier3Generating ? (
              <div className="t3-quiz">
                <div className="t3-quiz-header">
                  <span className="t3-quiz-header-title">✨ 4 步定制你的专属方案</span>
                  <span className="t3-quiz-header-count">{tier3CurrentQuestionIndex + 1} / {TIER3_QUESTIONS.length}</span>
                </div>
                <div className="t3-quiz-progress">
                  <div
                    className="t3-quiz-progress-fill"
                    style={{ width: ((tier3CurrentQuestionIndex) / TIER3_QUESTIONS.length) * 100 + '%' }}
                  />
                </div>
                {tier3CurrentQuestionIndex > 0 && (
                  <button className="t3-quiz-back" onClick={handleTier3Back}>‹ 上一题</button>
                )}
                {(() => {
                  // 问卷全部完成 → 照片上传步骤
                  const allAnswered = ['makeupStyle', 'scenario', 'skillLevel', 'timeCost'].every((d) => tier3Answers[d]);
                  // 照片已上传（tier3PhotoKey 有值）但生成失败/未完成：展示"重新分析"按钮，避免卡在 Q4 无操作
                  if (allAnswered && !tier3Content && !tier3Generating) {
                    return (
                      <div className="t3-photo-step">
                        <div className="t3-photo-step-head">
                          <span className="t3-photo-step-emoji">📷</span>
                          <p className="t3-photo-step-title">{tier3PhotoKey ? '重新生成专属方案' : '上传照片开始分析'}</p>
                        </div>
                        <p className="t3-photo-step-hint">{tier3PhotoKey ? '照片已上传，可重新生成；若刚才失败请点下方按钮重试。' : '请上传一张清晰的正面照片，将为你生成专属分析'}</p>
                        {tier3PhotoKey && !tier3Photo && (
                          <div className="t3-photo-actions">
                            <button className="t3-cta-btn" onClick={handleTier3DoSubmit} disabled={tier3Generating}>
                              {tier3Generating ? '生成中…' : '🔁 重新生成'}
                            </button>
                          </div>
                        )}
                        {tier3Photo ? (
                          <div className="t3-photo-selected">
                            <img className="t3-photo-preview" src={tier3Photo} alt="照片预览" />
                            <div className="t3-photo-actions">
                              <button className="t3-cta-btn" onClick={handleTier3PhotoSubmit} disabled={tier3PhotoUploading}>
                                {tier3PhotoUploading ? '上传中…' : '开始分析'}
                              </button>
                              <button className="t3-photo-resel" onClick={() => { setTier3Photo(null); setTier3PhotoError(null); }}>重新选择</button>
                            </div>
                          </div>
                        ) : (
                          <div className="t3-photo-actions">
                            {typeof navigator !== 'undefined' && navigator.userAgent?.match(/(iPhone|iPad|iPod|Android)/i) ? (
                              <>
                                <button className="t3-photo-pick" onClick={handleTier3PhotoPickCamera}>📷 拍照</button>
                                <button className="t3-photo-pick" onClick={handleTier3PhotoPickGallery}>🖼 从相册选择</button>
                              </>
                            ) : (
                              <button className="t3-photo-pick" onClick={() => tier3PhotoInputRef.current?.click()}>📁 选择照片</button>
                            )}
                            <input ref={tier3PhotoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleTier3PhotoInputChange} />
                          </div>
                        )}
                        {(tier3PhotoError || tier3Error) && <p className="report-q-error">{tier3PhotoError || tier3Error}</p>}
                      </div>
                    );
                  }
                  const q = TIER3_QUESTIONS[tier3CurrentQuestionIndex];
                  if (!q) return null;
                  const options = (tier3QuestionnaireOptions && tier3QuestionnaireOptions[q.key]) || TIER3_FALLBACK_OPTIONS[q.key] || [];
                  if (!options.length) return null;
                  return (
                    <div className="t3-q-card" key={tier3CurrentQuestionIndex}>
                      <p className="t3-q-emoji">{['🎨', '🎬', '👤', '⏱️'][tier3CurrentQuestionIndex] || '✦'}</p>
                      <p className="t3-q-title">{q.title}</p>
                      <div className="t3-q-options">
                        {options.map((opt) => (
                          <button
                            key={opt}
                            className={[
                              't3-q-option',
                              tier3Answers[q.key] === opt ? 't3-q-option--active' : '',
                              tier3AnswerFlash === q.key ? 't3-q-option--flash' : '',
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
              <div className="t3-generating">
                <div className="t3-generating-ring" />
                <p className="t3-generating-text">AI 正在根据你的偏好生成专属方案...</p>
                <p className="t3-generating-sub">通常需要几十秒，请稍候</p>
              </div>
            ) : null}
          </div>
        )}

          {showAd && <AdOverlay duration={AD_DURATION_SEC} onComplete={adMode === 'tier2gen' ? handleAdFinishForTier2Gen : adMode === 'tier2' ? handleAdFinishForTier2 : adMode === 'tier2redo' ? handleAdFinishForTier2Redo : handleAdFinish} />}
          {openPhoto && (
            <div className="photo-lightbox-overlay" onClick={() => setOpenPhoto(null)}>
              <img className="photo-lightbox-img" src={openPhoto} alt="放大预览" />
            </div>
          )}
        {showArchive && (
          <div className="archive-overlay" onClick={() => setShowArchive(false)}>
            <div className="archive-modal" onClick={(e) => e.stopPropagation()}>
              <div className="archive-modal-header">
                <span className="archive-modal-title">个人中心</span>
                <button className="archive-modal-close" onClick={() => setShowArchive(false)}>✕</button>
              </div>
              <div className="archive-modal-body">
                {myTier3Archives.length > 0 ? (
                  <>
                    <div className="pc-archive-header">
                      <span className="pc-archive-title">专属报告档案</span>
                      <span className="pc-archive-count">共 {myTier3Archives.length} 份</span>
                    </div>
                    {myTier3Archives.map((a) => {
                      const soon = a.expireAt ? (a.expireAt * 1000 - Date.now()) <= 5 * 24 * 60 * 60 * 1000 : false;
                      const isOpen = archiveOpenId === a.id;
                      return (
                        <div key={a.id} className={"pc-report-card" + (a.expired ? " pc-report-card--expired" : "")}>
                          <div className="pc-report-card-head" role="button" onClick={() => setArchiveOpenId(isOpen ? null : a.id)}>
                            {a.photoUrl ? (
                              <img className="pc-report-photo" src={a.photoUrl} alt="报告照片" />
                            ) : <div className="pc-report-photo pc-report-photo--empty">📷</div>}
                            <div className="pc-report-card-main">
                              <div className="pc-report-card-line">
                                <span className="pc-report-card-style">{a.style || a.scenario || "专属方案"}</span>
                                {a.expired ? <span className="pc-report-tag pc-report-tag--expired">已过期</span> : soon ? <span className="pc-report-tag pc-report-tag--soon">即将到期</span> : <span className="pc-report-tag">有效</span>}
                              </div>
                              <div className="pc-report-card-sub">生成于 {formatExpireDate(a.createdAt)} · 点击查看完整报告</div>
                            </div>
                            <span className="pc-report-card-arrow">{isOpen ? "↑" : "↓"}</span>
                          </div>
                          {isOpen ? (
                            <div className="pc-report-detail">
                              <div className="pc-report-detail-meta">
                                <div className="pc-report-row"><span className="pc-report-label">妆容风格</span><span className="pc-report-value">{a.style || a.scenario || "—"}</span></div>
                                <div className="pc-report-row"><span className="pc-report-label">生成时间</span><span className="pc-report-value">{formatExpireDate(a.createdAt)}</span></div>
                                <div className="pc-report-row"><span className="pc-report-label">到期时间</span><span className={"pc-report-value" + (soon ? " pc-expire-warn" : "")}>{formatExpireDate(a.expireAt)}</span></div>
                                {soon ? <p className="pc-expire-warning">⚠️ 专属报告即将到期，请及时查看</p> : null}
                              </div>
                              {archiveDetailLoading && archiveOpenId === a.id ? (
                                <p className="pc-report-detail-loading">报告详情加载中...</p>
                              ) : archiveDetail && archiveDetail.id === a.id && archiveDetail.content ? (
                                <Tier3Report
                                  content={{ ...archiveDetail.content, _scenario: archiveDetail.scenario || a.scenario || "今日妆容" }}
                                  photoUrl={archiveDetail.photoUrl}
                                  enrichPending={tier3EnrichPending}
                                />
                              ) : (
                                <p className="pc-report-detail-loading">无法加载该报告详情</p>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="archive-empty">
                    <p>暂无专属报告</p>
                    <p className="archive-empty-hint">在「专属」标签解锁并生成专属报告后，将在此展示</p>
                    <button
                      className="archive-reupload-btn"
                      onClick={() => {
                        setShowArchive(false);
                        setActiveTab("专属");
                      }}
                    >
                      ✨ 去生成专属报告
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}




