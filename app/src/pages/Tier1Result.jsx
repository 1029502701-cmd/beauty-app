import { useContext, useRef, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import RequireAuth from '../router/RequireAuth.jsx';
import { getCompliment } from './complimentMap.js';
import { BASE } from '../api.js';
import { getStorageItem, STORAGE_KEYS } from '../utils/storage.js';

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
}

/** 检测是否在 Capacitor 原生环境 */
function isNativeCapacitor() {
  try {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();
  } catch {
    return false;
  }
}

export default function Tier1Result() {
  const { token } = useContext(AuthContext);

  const state = window.history.state || {};
  const photo = state.preview ?? null;
  const report = state.reportData ?? null;
  // 使用 analyze 接口返回的真实 reportId（Capture.jsx 通过 history state 传入）
  const reportId = state.reportId ?? null;

  const resolvedResults = RESULT_ITEMS.map((item) => {
    const value = report?.[item.key] ?? item.placeholder;
    const compliment = getCompliment(item.key, value);
    return { ...item, value, compliment };
  });

  const highlightText = report?.highlight ?? '发现你的独特之美';
  const personaTags = report?.personaTags ? [report.personaTags] : ['温柔知性风', '清透裸妆感'];

  // 分享相关状态
  const [shareLoading, setShareLoading] = useState(false);
  const [shareDone, setShareDone] = useState(false);
  const [openPhoto, setOpenPhoto] = useState(null);
  // 隐藏分享卡片 DOM 引用
  const shareCardRef = useRef(null);
  // QR code canvas 引用（渲染到卡片 DOM 中）
  const qrCanvasRef = useRef(null);
  // 本次分享用的 shareUrl
  const shareUrlRef = useRef('');

  /** 点击分享按钮的完整流程 */
  const handleShareReport = useCallback(async () => {
    if (shareLoading || !reportId) return;
    setShareLoading(true);
    setShareDone(false);

    try {
      // 1. 调用后端获取 token 和 shareUrl
      const shareToken = await getStorageItem(STORAGE_KEYS.SESSION_TOKEN);
      const res = await fetch(BASE + '/tier1/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${shareToken}`,
        },
        body: JSON.stringify({ reportId }),
      });
      if (!res.ok) throw new Error('分享接口请求失败');
      const { shareUrl } = await res.json();
      shareUrlRef.current = shareUrl;

      // 2. 生成 QR code 到 canvas（必须在前端完成，等 DOM 挂载后执行）
      const QRCode = await import('qrcode');
      await QRCode.default.toCanvas(qrCanvasRef.current, shareUrl, {
        width: 160,
        margin: 1,
        color: { dark: '#2d2d2d', light: '#ffffff' },
      });

      // 3. 等待 canvas 绘制完成，再用 html2canvas 截图整个卡片
      await new Promise((r) => setTimeout(r, 50));

      const html2canvas = (await import('html2canvas')).default;
      const cardEl = shareCardRef.current;
      if (!cardEl) throw new Error('分享卡片 DOM 未就绪');

      const canvas = await html2canvas(cardEl, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/png', 1.0)
      );
      if (!blob) throw new Error('截图生成失败');

      // 4. 根据平台选择分享方式
      const native = isNativeCapacitor();

      if (native) {
        // 原生 Capacitor：写入 Documents 目录，再调用 Share API
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const fileName = `share-card-${Date.now()}.png`;
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result?.toString().split(',')[1]);
          reader.readAsDataURL(blob);
        });
        await Filesystem.writeFile({
          path: fileName,
          directory: Directory.Documents,
          data: base64,
        });
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: '我的美妆分析报告',
          text: `看看我的美妆分析结果！\n${shareUrl}`,
          url: `file://${fileName}`,
          dialogTitle: '分享到',
        });
      } else {
        // Web 环境：尝试 Web Share API，不支持则下载图片
        try {
          const file = new File([blob], '美妆分析报告.png', { type: 'image/png' });
          if (navigator.share) {
            await navigator.share({
              title: '我的美妆分析报告',
              text: `看看我的美妆分析结果！\n${shareUrl}`,
              files: [file],
            });
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '美妆分析报告.png';
            a.click();
            URL.revokeObjectURL(url);
          }
        } catch (shareErr) {
          // 用户取消分享或平台不支持，静默处理
          console.log('[Tier1Result] 分享已取消或不可用:', shareErr);
        }
      }

      setShareDone(true);
    } catch (err) {
      console.error('[Tier1Result] 分享异常:', err);
    } finally {
      setShareLoading(false);
    }
  }, [shareLoading, reportId]);

  return (
    <RequireAuth fallbackPath="/home">
      <div className="tier1-result-page">
        {/* ── 隐藏分享卡片（仅用于截图，不占据视觉空间）── */}
        <div
          ref={shareCardRef}
          className="share-card"
          style={{ position: 'absolute', left: -9999, top: 0 }}
        >
          {/* 顶部照片 */}
          <div className="share-card-photo-wrap">
            {photo ? (
              <img className="share-card-photo" src={photo} alt="你的照片" />
            ) : (
              <div className="share-card-photo-placeholder">📷</div>
            )}
          </div>
          {/* 人设标签 */}
          <div className="share-card-tags">
            {personaTags.map((tag, i) => (
              <span key={i} className="share-card-tag">{tag}</span>
            ))}
          </div>
          {/* 亮点文案 */}
          <div className="share-card-highlight">
            <p className="share-card-highlight-text">{highlightText}</p>
          </div>
          {/* 二维码 */}
          <div className="share-card-qr-wrap">
            <canvas ref={qrCanvasRef} className="share-card-qr" />
            <p className="share-card-qr-hint">扫码查看我的分析报告</p>
          </div>
        </div>

        {/* ── 正常页面内容 ── */}
        <div className="tier1-result-header">
          <button className="tier1-result-back-btn" onClick={navigateBack}>‹ 返回</button>
          <span className="tier1-result-title">你的美妆分析结果</span>
          <div className="tier1-result-header-spacer" />
        </div>
        <div className="tier1-result-hero">
          {photo ? (
            <img className="tier1-result-photo" src={photo} alt="你的照片" style={{ aspectRatio: '3/4' }} onClick={() => setOpenPhoto(photo)} />
          ) : (
            <div className="tier1-result-photo-placeholder">📷</div>
          )}
          <div className="tier1-result-tags">
            {personaTags.map((tag, i) => (
              <span key={i} className="tier1-result-tag">{tag}</span>
            ))}
          </div>
        </div>
        <div className="tier1-result-section">
          <h2 className="tier1-result-section-title">分析结果</h2>
          <div className="tier1-result-grid">
            {resolvedResults.map((item) => (
              <div key={item.key} className="tier1-result-item">
                <span className="tier1-result-item-icon">{item.icon}</span>
                <div className="tier1-result-item-body">
                  <span className="tier1-result-item-label">{item.label}</span>
                  <span className="tier1-result-item-value">{item.value}</span>
                  <span className="tier1-result-item-compliment">— {item.compliment}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="tier1-result-section">
          <h2 className="tier1-result-section-title">✨ 你的亮点</h2>
          <div className="tier1-result-highlight-card">
            <p className="tier1-result-highlight-text">{highlightText}</p>
          </div>
        </div>
        <div className="tier1-result-cta">
          <button
            className="tier1-result-cta-btn"
            onClick={handleShareReport}
            disabled={shareLoading || !reportId}
          >
            {shareLoading ? '生成分享中…' : shareDone ? '✓ 已分享' : '分享解锁进阶报告'}
          </button>
          <p className="tier1-result-cta-hint">分享后即可解锁进阶报告</p>
        </div>
      </div>
          {openPhoto && (
            <div className="photo-lightbox-overlay" onClick={() => setOpenPhoto(null)}>
              <img className="photo-lightbox-img" src={openPhoto} alt="放大预览" />
            </div>
          )}
    </RequireAuth>
  );
}

