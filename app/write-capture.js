const fs = require('fs');
const path = 'C:/Users/yao/Documents/ChatGPT/美妆app/app/src/pages/Capture.jsx';
const content = `import { useState, useCallback, useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BASE } from '../api.js';

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
const MIN_ANIM_DURATION_MS = 800;

/* --- 辅助函数 --- */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function callAnalyze(base64, token, signal) {
  const blob = await fetch(base64, { signal }).then((r) => r.blob());
  const form = new FormData();
  form.append('photo', blob, 'capture.jpg');
  const res = await fetch(BASE + '/tier1/analyze', {
    method: 'POST',
    headers: { Authorization: \`Bearer ${token}\` },
    body: form,
    signal,
  });
  if (!res.ok) throw new Error(\`请求失败: ${res.status}\`);
  return res.json();
}

/* --- 导航（模块级）--- */

function navigateHome() {
  window.history.pushState({}, '', '/home');
  window.location.reload();
}

/* --- 主组件 --- */

export default function Capture() {
  const [stage, setStage] = useState('select');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [reportData, setReportData] = useState(null);

  // 用 ref 跟踪当前活跃的 AbortController，重试时主动中止旧请求
  const controllerRef = useRef(null);

  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('session_token') : null;

  const pickImage = useCallback(async (source) => {
    try {
      const result = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source,
      });
      const dataUrl = result.dataUrl;
      if (!dataUrl) throw new Error('未获取到图片数据');
      setPreview(dataUrl);
      setStage('analyzing');
      startAnalysis(dataUrl);
    } catch (e) {
      setError(e.message);
      setStage('error');
    }
  }, []);

  const handleFileInput = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToBase64(file);
      setPreview(dataUrl);
      setStage('analyzing');
      startAnalysis(dataUrl);
    } catch (e) {
      setError(e.message);
      setStage('error');
    }
  }, []);

  const startAnalysis = useCallback((base64) => {
    setVisibleCount(0);
    setApiReady(false);
    setApiError(null);
    setReportData(null);

    // 阶段 A：按错落间隔依次显示检查项
    STEP_DELAYS.forEach((delay, i) => {
      setTimeout(() => setVisibleCount(i + 1), delay);
    });

    const totalStepTime = STEP_DELAYS[STEP_DELAYS.length - 1] + 400;
    const minAnimEnd = totalStepTime + MIN_ANIM_DURATION_MS;

    // 新建 AbortController，中止正在进行的旧请求
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    // 阶段 B：后台发起 API 请求
    (async () => {
      try {
        const data = await callAnalyze(base64, token, controller.signal);
        setReportData(data.report);
        setApiReady(true);
      } catch (e) {
        // 用户主动 abort 不视为错误，静默忽略
        if (e.name === 'AbortError') return;
        setApiError(e.message);
        setApiReady(false);
      }
    })();

    // 阶段 C：动画走完后统一决定进入 done 还是继续等待
    setTimeout(() => {
      if (apiReady) {
        setStage('done');
      } else if (apiError) {
        setStage('error');
      } else {
        setStage('analyzing');
      }
    }, minAnimEnd);
  }, [token, apiReady, apiError]);

  const handleRetry = useCallback(() => {
    if (!preview) return;
    // 中止旧请求，防止其回调覆盖新请求状态
    controllerRef.current?.abort();
    setStage('analyzing');
    startAnalysis(preview);
  }, [preview, startAnalysis]);

  const handleViewReport = useCallback(() => {
    // 跳转到 tier1 结果页，携带用户照片和分析结果
    // TODO: 后续可改为带 reportId 的 URL 参数，页面内再请求详情接口
    window.history.pushState({ preview, reportData }, '', '/tier1-result');
    window.location.reload();
  }, [preview, reportData]);

  /* --- Stage 1：选择图片 --- */
  if (stage === 'select') {
    return (
      <div className="capture-page">
        <div className="capture-header">
          <button className="capture-back-btn" onClick={navigateHome}>‹ 返回</button>
          <span className="capture-title">生成美妆报告</span>
        </div>
        <div className="capture-select-area">
          <p className="capture-hint">请上传一张正面清晰自拍，方便我们为你生成美妆建议</p>
          <div className="capture-actions">
            <button
              className="capture-action-btn capture-camera-btn"
              onClick={() => pickImage(CameraSource.Camera)}
            >
              <span className="capture-icon">📷</span>
              拍照
            </button>
            <button
              className="capture-action-btn capture-gallery-btn"
              onClick={() => pickImage(CameraSource.Photos)}
            >
              <span className="capture-icon">🖼</span>
              从相册选择
            </button>
            <label className="capture-action-btn capture-web-btn">
              <span className="capture-icon">📁</span>
              选择本地文件
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="capture-file-input"
                onChange={handleFileInput}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  /* --- Stage 2/3：分析中 / 结果 --- */
  return (
    <div className="capture-page">
      <div className="capture-header">
        <button className="capture-back-btn" onClick={navigateHome}>‹ 返回</button>
          <span className="capture-title">生成美妆报告</span>
      </div>
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
      {stage === 'done' && reportData && (
        <div className="capture-done">
          <div className="capture-checkmark">✓</div>
          <p className="capture-done-title">分析完成</p>
          <p className="capture-done-sub">已为你生成专属美妆建议</p>
          <button className="capture-view-report-btn" onClick={handleViewReport}>
            查看报告
          </button>
        </div>
      )}
    </div>
  );
}
`;
fs.writeFileSync(path, content, 'utf8');
console.log('Done:', path);
