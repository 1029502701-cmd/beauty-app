import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { BASE } from '../api.js';
import { checkAndResize } from '../utils/imageResize.js';
import { getStorageItem, STORAGE_KEYS } from '../utils/storage.js';

/* --- 判断是否在 Capacitor/小程序 环境 --- */
const isNativeEnv = typeof navigator !== 'undefined' && !!navigator.userAgent?.match(/(iPhone|iPad|iPod|Android)/i);

/* --- 常量 --- */

const ANALYSIS_STEPS = [
  '分析脸型',
  '分析三庭五眼比例',
  '分析眉形',
  '分析眼型',
  '分析肤质',
  '分析五官对称度',
];

const STEP_DELAYS = [0, 650, 1500, 1900, 2700, 3200];
const API_TIMEOUT_MS = 60_000;

/* --- 辅助函数 --- */

function resizeDataUrl(dataUrl, maxSide = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width >= 512 && height >= 512 && width <= maxSide && height <= maxSide) {
        resolve(dataUrl);
        return;
      }
      let newWidth, newHeight;
      if (width >= height) {
        newWidth = maxSide;
        newHeight = Math.round((height / width) * maxSide);
      } else {
        newHeight = maxSide;
        newWidth = Math.round((width / height) * maxSide);
      }
      if (newWidth < 512 || newHeight < 512) {
        const scale = 512 / Math.max(width, height);
        newWidth = Math.round(width * scale);
        newHeight = Math.round(height * scale);
        if (newWidth < 512 || newHeight < 512) { resolve(dataUrl); return; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

async function callAnalyze(base64, token, signal) {
  if (typeof base64 !== 'string' || !base64) {
    throw new Error('无效的图片数据，请重新选择照片');
  }
  let blob;
  if (base64.startsWith('data:')) {
    const byteStr = atob(base64.split(',')[1]);
    const arr = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
    blob = new Blob([arr], { type: 'image/jpeg' });
  } else {
    blob = await fetch(base64, { signal }).then((r) => r.blob());
  }
  const form = new FormData();
  form.append('photo', blob, 'capture.jpg');
  const res = await fetch(BASE + '/tier1/analyze', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal,
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || err.error || `请求失败: ${res.status}`); }
  return res.json();
}

/* --- 导航 --- */

function navigate(path, state) {
  window.history.pushState(state || {}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function navigateHome() {
  navigate('/home');
}

function extractRefParam() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
  }
  return ref;
}

/* --- 档案弹窗 --- */

function ArchiveModal({ reports, onClose, onSelect }) {
  if (!reports) return null;
  const empty = reports.length === 0;
  return (
    <div className="capture-archive-overlay" onClick={onClose}>
      <div className="capture-archive-panel" onClick={(e) => e.stopPropagation()}>
        <div className="capture-archive-header">
          <span className="capture-archive-title">我的美妆档案</span>
          <button className="capture-archive-close" onClick={onClose}>✕</button>
        </div>
        {empty ? (
          <div className="capture-archive-empty">还没有美妆报告哦~</div>
        ) : (
          <div className="capture-archive-list">
            {reports.map((r) => (
              <div
                key={r.id}
                className="capture-archive-item"
                onClick={() => { onSelect(r.id); onClose(); }}
              >
                <span className="capture-archive-scenario">
                  {r.scenario || '未命名场景'}
                </span>
                <span className={`capture-archive-tag capture-archive-tag--${r.access_type === 'share_unlock' ? 'share' : 'regular'}`}>
                  {r.access_type === 'share_unlock' ? '今日分享解锁' : `剩余 ${r.daysLeft ?? 0} 天`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


export default function Capture() {
  const { token } = useContext(AuthContext);
  const [stage, setStage] = useState('select');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [refToken, setRefToken] = useState(() => extractRefParam());

  // 档案相关
  const [showArchive, setShowArchive] = useState(false);
  const [archiveReports, setArchiveReports] = useState(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState(null);
  const [openPreview, setOpenPreview] = useState(null);

  const controllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const generationRef = useRef(0);
  const completionTimeoutRef = useRef(null);

  // 加载档案列表
  const loadArchive = useCallback(async () => {
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const res = await fetch(BASE + '/reports/mine', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || err.error || `请求失败: ${res.status}`); }
      const data = await res.json();
      setArchiveReports(data.reports || []);
    } catch (e) {
      setArchiveError(e.message);
      setArchiveReports([]);
    } finally {
      setArchiveLoading(false);
    }
  }, [token]);

  const handleViewReport = useCallback((reportIdVal) => {
    const stored = sessionStorage.getItem('capture_report_id');
    navigate('/report', { reportId: reportIdVal, preview, reportData: stored ? null : reportData });
  }, [preview, reportData]);

  const startAnalysis = useCallback((base64) => {
    const gen = ++generationRef.current;
    setVisibleCount(0);
    setApiReady(false);
    setApiError(null);
    setReportData(null);
    setReportId(null);

    if (completionTimeoutRef.current !== null) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }

    STEP_DELAYS.forEach((delay, i) => {
      setTimeout(() => setVisibleCount(i + 1), delay);
    });

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    (async () => {
      try {
        const data = await callAnalyze(base64, token, controller.signal);

        if (generationRef.current !== gen) return;

        setReportData(data.report);
        setReportId(data.reportId ?? null);
        // 存入 session，供 ReportPage 读取 tier1 内容
        if (data.reportId && data.report) {
          sessionStorage.setItem('capture_report_' + data.reportId, JSON.stringify(data.report));
        }
        setApiReady(true);

        if (refToken) {
          const refTokenVal = await getStorageItem(STORAGE_KEYS.SESSION_TOKEN);
          fetch(BASE + '/tier1/confirm-referral', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${refTokenVal}`,
            },
            body: JSON.stringify({ ref: refToken }),
          }).catch(() => {});
        }

        // 存入 session，供 ReportPage 读取
        if (data.reportId) {
          sessionStorage.setItem('capture_report_id', data.reportId);
          sessionStorage.setItem('capture_preview', preview || '');
        }

        setStage('done');
      } catch (e) {
        if (generationRef.current !== gen) return;
        if (e.name === 'AbortError') return;
        setApiError(e.message);
        setApiReady(false);
        setStage('error');
      }
    })();

    completionTimeoutRef.current = setTimeout(() => {
      completionTimeoutRef.current = null;
      if (generationRef.current === gen && !apiReady && !apiError && stage !== 'done' && stage !== 'error') {
        setApiError('分析耗时较长，请稍后重试');
        setStage('error');
      }
    }, API_TIMEOUT_MS);
  }, [token, stage, refToken, apiReady, apiError, preview]);

  const handleSelectPhoto = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await checkAndResize(file);
      if (typeof dataUrl !== 'string') throw new Error('图片处理失败，请重试');
      setPreview(dataUrl);
      setStage('analyzing');
      startAnalysis(dataUrl);
    } catch (e) {
      setError(e.message);
      setStage('error');
    }
    e.target.value = '';
  }, [startAnalysis]);

  const handleRetry = useCallback(async () => {
    if (!preview) return;
    controllerRef.current?.abort();
    if (completionTimeoutRef.current !== null) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
    setStage('analyzing');
    // 重新走完整压缩流程（与首次上传 handleFileChange 一致），
    // 避免 preview 是未压缩原图时把大 token 数据发出去
    try {
      const byteStr = atob(preview.split(',')[1]);
      const arr = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
      const blob = new Blob([arr], { type: 'image/jpeg' });
      const resizedDataUrl = await checkAndResize(blob);
      startAnalysis(resizedDataUrl);
    } catch (e) {
      setError(e.message);
      setStage('error');
    }
  }, [preview, startAnalysis]);

  const openArchive = useCallback(() => {
    setShowArchive(true);
    if (!archiveReports && !archiveLoading) {
      loadArchive();
    }
  }, [archiveReports, archiveLoading, loadArchive]);

  if (stage === 'select') {
    return (
      <div className="capture-page">
        <div className="capture-header">
          <button className="capture-back-btn" onClick={navigateHome}>‹ 返回</button>
          <span className="capture-title">生成美妆报告</span>
          <button className="capture-archive-btn" onClick={openArchive} title="我的档案">
            📁
          </button>
        </div>
        <div className="capture-select-area">
          <p className="capture-hint">请上传一张正面清晰自拍，方便我们为你生成美妆建议</p>
          <div className="capture-actions">
            {isNativeEnv ? (
              <>
                <button
                  className="capture-action-btn capture-camera-btn"
                  onClick={() => {
                    import('@capacitor/camera').then(({ Camera, CameraSource }) =>
                      Camera.getPhoto({ quality: 85, allowEditing: false, resultType: 1, source: CameraSource.Camera })
                        .then(async (r) => {
                          const resized = await resizeDataUrl(r.dataUrl);
                          setPreview(resized);
                          setStage('analyzing');
                          startAnalysis(resized);
                        })
                        .catch(err => { setError(err.message); setStage('error'); })
                    ).catch(() => handleSelectPhoto());
                  }}
                >
                  <span className="capture-icon">📷</span> 拍照
                </button>
                <button
                  className="capture-action-btn capture-gallery-btn"
                  onClick={() => {
                    import('@capacitor/camera').then(({ Camera, CameraSource }) =>
                      Camera.getPhoto({ quality: 85, allowEditing: false, resultType: 1, source: CameraSource.Photos })
                        .then(async (r) => {
                          const resized = await resizeDataUrl(r.dataUrl);
                          setPreview(resized);
                          setStage('analyzing');
                          startAnalysis(resized);
                        })
                        .catch(err => { setError(err.message); setStage('error'); })
                    ).catch(() => handleSelectPhoto());
                  }}
                >
                  <span className="capture-icon">🖼</span> 从相册选择
                </button>
              </>
            ) : (
              <button className="capture-action-btn capture-web-btn" onClick={handleSelectPhoto}>
                <span className="capture-icon">📁</span> 选择照片
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </div>
        {showArchive && (
          <ArchiveModal
            reports={archiveLoading ? null : archiveReports}
            onClose={() => setShowArchive(false)}
            onSelect={handleViewReport}
          />
        )}
        <button className="capture-influencer-btn" onClick={() => navigate('/influencer-apply')} title="达人入驻">
          ✨ 达人入驻
        </button>
      </div>
    );
  }

  return (
    <div className="capture-page">
      <div className="capture-header">
        <button className="capture-back-btn" onClick={navigateHome}>‹ 返回</button>
        <span className="capture-title">生成美妆报告</span>
        <button className="capture-archive-btn" onClick={openArchive} title="我的档案">
          📁
        </button>
      </div>
      {preview && (
        <div className="capture-preview-wrap">
          <img className="capture-preview-img" src={preview} alt="预览" onClick={() => setOpenPreview(preview)} />
        </div>
      )}
      {stage === 'error' && (
        <div className="capture-error">
          <div className="capture-error-icon">⚠️</div>
          <p className="capture-error-text">{error || '分析失败，请稍后重试'}</p>
          <button className="capture-retry-btn" onClick={handleRetry}>重试</button>
        </div>
      )}
      {stage === 'analyzing' && (
        <div className="capture-analyzing">
          <ul className="capture-steps">
            {ANALYSIS_STEPS.map((label, i) => (
              <li
                key={i}
                className={`capture-step ${i < visibleCount ? 'capture-step--visible' : ''}`}
              >
                <span className="capture-step-check">
                  {i < visibleCount ? '✓' : '·'}
                </span>
                <span className="capture-step-label">{label}</span>
              </li>
            ))}
          </ul>
          {visibleCount >= ANALYSIS_STEPS.length && !apiReady && !apiError && (
            <p className="capture-pending-text">正在整理结果中...</p>
          )}
        </div>
      )}
      {stage === 'done' && (
        <div className="capture-done">
          <div className="capture-checkmark">✓</div>
          <p className="capture-done-title">分析完成</p>
          <p className="capture-done-sub">已为你生成专属美妆建议</p>
          <button className="capture-view-report-btn" onClick={() => handleViewReport(reportId)}>
            查看报告
          </button>
        </div>
      )}
      {showArchive && (
        <ArchiveModal
          reports={archiveLoading ? null : archiveReports}
          onClose={() => setShowArchive(false)}
          onSelect={handleViewReport}
        />
      )}
      {openPreview && (
        <div className="photo-lightbox-overlay" onClick={() => setOpenPreview(null)}>
          <img className="photo-lightbox-img" src={openPreview} alt="放大预览" />
        </div>
      )}
    </div>
  );
}
