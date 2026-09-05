import { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { BASE } from '../api.js';
import { checkAndResize } from '../utils/imageResize.js';

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
  const effectiveToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null);
  if (typeof base64 !== 'string' || !base64) {
    throw new Error('无效的图片数据，请重新选择照片');
  }
  if (!effectiveToken) {
    throw new Error('请先登录');
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
    headers: { Authorization: `Bearer ${effectiveToken}`},
    body: form,
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || `请求失败: ${res.status}`);
  }
  return res.json();
}

/* --- 可复用的拍照/上传组件 --- */
export default function CapturePhotoUpload({ onComplete, onCancel, compact }) {
  const { token } = useContext(AuthContext);
  const [stage, setStage] = useState('select');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportId, setReportId] = useState(null);

  const controllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const generationRef = useRef(0);
  const completionTimeoutRef = useRef(null);

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
        if (data.reportId && data.report) {
          sessionStorage.setItem('capture_report_' + data.reportId, JSON.stringify(data.report));
        }
        setApiReady(true);

        if (data.reportId) {
          sessionStorage.setItem('capture_report_id', data.reportId);
          sessionStorage.setItem('capture_preview', preview || '');
        }

        setStage('done');
        onComplete?.(data.reportId, data.report, preview);
      } catch (e) {
        if (generationRef.current !== gen) return;
        if (e.name === 'AbortError') return;
        setError(e.message);
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
  }, [token, stage, apiReady, apiError, preview, onComplete]);

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
    setError(null);
    setApiError(null);
    if (!preview) return;
    controllerRef.current?.abort();
    if (completionTimeoutRef.current !== null) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
    setStage('analyzing');
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

  const handleCancel = useCallback(() => {
    controllerRef.current?.abort();
    setStage('select');
    setPreview(null);
    setError(null);
    onCancel?.();
  }, [onCancel]);

  if (stage === 'select') {
    return (
      <div className={compact ? 'capture-compact-area' : 'capture-select-area'}>
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
    );
  }

  return (
    <div className="capture-inline-area">
      {preview && (
        <div className="capture-preview-wrap">
          <img className="capture-preview-img" src={preview} alt="预览" />
        </div>
      )}
      {stage === 'error' && (
        <div className="capture-error">
          <div className="capture-error-icon">⚠️</div>
          <p className="capture-error-text">{error || '分析失败，请稍后重试'}</p>
          <button className="capture-retry-btn" onClick={handleRetry}>重试</button>
          {!compact && <button className="capture-cancel-btn" onClick={handleCancel}>取消</button>}
        </div>
      )}
      {stage === 'analyzing' && (
        <div className="capture-analyzing">
          <ul className="capture-steps">
            {ANALYSIS_STEPS.map((label, i) => (
              <li key={i} className={`capture-step${i < visibleCount ? ' capture-step--visible' : ''}`}>
                <span className="capture-step-check">{i < visibleCount ? '✓' : '·'}</span>
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
          <button className="capture-view-report-btn" onClick={() => onComplete?.(reportId, reportData, preview)}>查看详情</button>
        </div>
      )}
    </div>
  );
}
