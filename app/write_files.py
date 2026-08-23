import os

capture_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\Capture.jsx'
tier1_path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\Tier1Result.jsx'

capture_content = r'''import { useState, useCallback, useRef } from 'react';
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
    headers: { Authorization: Bearer  },
    body: form,
    signal,
  });
  if (!res.ok) throw new Error(请求失败: );
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
                className={capture-step }
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
'''

tier1_content = r'''import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import RequireAuth from '../router/RequireAuth.jsx';

/**
 * Tier1Result — 一级分析结果页
 *
 * 数据来源：Capture.jsx 跳转时通过 window.history.pushState 传入 state
 *   state.preview     — 用户照片 base64
 *   state.reportData  — analyze.ts 返回的 report 对象
 *
 * analyze.ts 当前返回字段（占位实现，后续补齐）：
 *   - faceShape: string       （例："圆脸"）
 *   - skinType:  string        （例："混合肌"）
 *   - suggestions: string[]    （建议列表）
 *
 * 以下字段目前未返回，已用 TODO 占位文案标注，待后端补齐后替换：
 *   - eyebrowShape   TODO：analyze.ts 尚未返回眉形字段
 *   - eyeShape       TODO：analyze.ts 尚未返回眼型字段
 *   - threeFiveRatio TODO：analyze.ts 尚未返回三庭五眼字段
 *   - symmetry       TODO：analyze.ts 尚未返回对称度字段
 *   - personaTags    TODO：analyze.ts 无此字段，前端占位展示
 *   - highlight      TODO：当前用 suggestions[0] 替代，待后端定义 highlight 结构
 */

const RESULT_ITEMS = [
  { key: 'faceShape',        label: '脸型',         icon: '◎' },
  { key: 'skinType',         label: '肤质',         icon: '◉' },
  { key: 'eyebrowShape',     label: '眉形',         icon: '❖', placeholder: '待分析' },
  { key: 'eyeShape',         label: '眼型',         icon: '◐', placeholder: '待分析' },
  { key: 'threeFiveRatio',   label: '三庭五眼',     icon: '☰', placeholder: '待分析' },
  { key: 'symmetry',         label: '五官对称度',   icon: '⚖', placeholder: '待分析' },
];

function navigateBack() {
  window.history.pushState({}, '', '/home');
  window.location.reload();
}

function handleShareReport() {
  // TODO: 分享卡片图片生成 & 触发分享/解锁 tier2 逻辑
  console.log('[Tier1Result] 分享解锁进阶报告（占位）');
  alert('分享功能开发中，敬请期待 ✨');
}

export default function Tier1Result() {
  const { token } = useContext(AuthContext);

  // 从路由 state 取数据（Capture.jsx 分析完成后传入）
  const state = window.location.state || {};
  const photo = state.preview ?? null;
  const report = state.reportData ?? null;

  // 从 report 中提取各字段值（未返回的字段降级为占位文案）
  const resolvedResults = RESULT_ITEMS.map((item) => ({
    ...item,
    value: item.placeholder ?? (report?.[item.key] ?? item.placeholder),
  }));

  // highlight：优先用 suggestions[0]，其次用固定文案
  // TODO：待 analyze.ts 定义 highlight 字段后替换此逻辑
  const highlightText = report?.suggestions?.[0] ?? '发现你的独特之美';

  // 人设标签：TODO — analyze.ts 无此字段，先用固定占位文案
  // TODO：待后端返回 personaTags 后替换
  const personaTags = ['温柔知性风', '清透裸妆感'];

  return (
    <RequireAuth fallbackPath="/home">
      <div className="tier1-result-page">
        {/* 头部 */}
        <div className="tier1-result-header">
          <button className="tier1-result-back-btn" onClick={navigateBack}>‹ 返回</button>
          <span className="tier1-result-title">你的美妆分析结果</span>
          <div className="tier1-result-header-spacer" />
        </div>

        {/* 头图区：用户照片 + 人设标签 */}
        <div className="tier1-result-hero">
          {photo ? (
            <img className="tier1-result-photo" src={photo} alt="你的照片" />
          ) : (
            <div className="tier1-result-photo-placeholder">📷</div>
          )}
          <div className="tier1-result-tags">
            {personaTags.map((tag, i) => (
              <span key={i} className="tier1-result-tag">{tag}</span>
            ))}
            {/* TODO：personas 字段由 analyze.ts 返回后再替换 */}
          </div>
        </div>

        {/* 6 项简版结果 */}
        <div className="tier1-result-section">
          <h2 className="tier1-result-section-title">分析结果</h2>
          <div className="tier1-result-grid">
            {resolvedResults.map((item) => (
              <div key={item.key} className="tier1-result-item">
                <span className="tier1-result-item-icon">{item.icon}</span>
                <div className="tier1-result-item-body">
                  <span className="tier1-result-item-label">{item.label}</span>
                  <span className="tier1-result-item-value">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 亮点区块：强调色背景，与其他6项区分开 */}
        <div className="tier1-result-section">
          <h2 className="tier1-result-section-title">✨ 你的亮点</h2>
          <div className="tier1-result-highlight-card">
            <p className="tier1-result-highlight-text">{highlightText}</p>
            {/* TODO：待 analyze.ts 定义 highlight 字段后替换文案来源 */}
          </div>
        </div>

        {/* CTA 区 */}
        <div className="tier1-result-cta">
          <button className="tier1-result-cta-btn" onClick={handleShareReport}>
            分享解锁进阶报告
          </button>
          <p className="tier1-result-cta-hint">分享后即可解锁进阶报告</p>
          {/* TODO：分享卡片图片生成、真实分享触发、tier2 解锁逻辑，下一步单独实现 */}
        </div>
      </div>
    </RequireAuth>
  );
}
'''

with open(capture_path, 'w', encoding='utf8') as f:
    f.write(capture_content)
print('Done:', capture_path)

with open(tier1_path, 'w', encoding='utf8') as f:
    f.write(tier1_content)
print('Done:', tier1_path)
