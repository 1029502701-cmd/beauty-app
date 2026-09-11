import { useState, useRef, useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { BASE } from '../api.js';
import { checkAndResize } from '../utils/imageResize.js';

/* 进阶报告（独立）照片上传：选择/拍摄照片 → 调 /tier2/generate-standalone → onStarted 通知父组件开始轮询
   不创建初识报告、不消耗初识每日次数 */

const isNativeEnv = typeof navigator !== 'undefined' && !!navigator.userAgent?.match(/(iPhone|iPad|iPod|Android)/i);

function dataUrlToBlob(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = dataUrl.slice(commaIdx + 1);
  const mime = dataUrl.slice(5, commaIdx) || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export default function Tier2PhotoUpload({ tier2ReportId, onStarted, title, compact = false }) {
  const { token } = useContext(AuthContext);
  const [photo, setPhoto] = useState(null); // dataURL
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setError(null);
      const dataUrl = await checkAndResize(file);
      setPhoto(dataUrl);
    } catch (err) {
      setError('照片处理失败，请换一张试试');
    }
  };

  const handlePickFromCamera = async () => {
    try {
      setError(null);
      const { Camera, CameraSource } = await import('@capacitor/camera');
      const r = await Camera.getPhoto({ quality: 85, allowEditing: false, resultType: 1, source: CameraSource.Camera });
      setPhoto(r.dataUrl);
    } catch (err) {
      fileInputRef.current?.click();
    }
  };

  const handlePickFromGallery = async () => {
    try {
      setError(null);
      const { Camera, CameraSource } = await import('@capacitor/camera');
      const r = await Camera.getPhoto({ quality: 85, allowEditing: false, resultType: 1, source: CameraSource.Photos });
      setPhoto(r.dataUrl);
    } catch (err) {
      fileInputRef.current?.click();
    }
  };

  const handleSubmit = async () => {
    if (!photo || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const blob = dataUrlToBlob(photo);
      const form = new FormData();
      form.append('photo', blob, 'tier2-photo.jpg');
      if (tier2ReportId) form.append('tier2ReportId', tier2ReportId); // 无 reportId 时由后端自动创建当日记录
      const res = await fetch(BASE + '/tier2/generate-standalone', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || data?.error || `上传失败 (${res.status})`);
        return;
      }
      onStarted?.(data.tier2ReportId || tier2ReportId);
    } catch {
      setError('网络异常，请重试');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={compact ? 'tier2-photo-area tier2-photo-area--compact' : 'tier2-photo-area'}>
      {title && <p className="tier2-photo-title">{title}</p>}
      {!photo ? (
        <div className="tier2-photo-actions">
          {isNativeEnv ? (
            <>
              <button className="capture-action-btn capture-camera-btn" onClick={handlePickFromCamera}>
                <span className="capture-icon">📷</span> 拍照
              </button>
              <button className="capture-action-btn capture-gallery-btn" onClick={handlePickFromGallery}>
                <span className="capture-icon">🖼</span> 从相册选择
              </button>
            </>
          ) : (
            <button className="capture-action-btn capture-web-btn" onClick={() => fileInputRef.current?.click()}>
              <span className="capture-icon">📁</span> 选择照片
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      ) : (
        <div className="tier2-photo-selected">
          <img className="tier2-photo-preview" src={photo} alt="照片预览" />
          <div className="tier2-photo-actions">
            <button className="report-unlock-btn" onClick={handleSubmit} disabled={uploading}>
              {uploading ? '提交中…' : '生成进阶报告'}
            </button>
            <button className="report-redo-btn" onClick={() => { setPhoto(null); setError(null); }}>重新选择照片</button>
          </div>
        </div>
      )}
      {error && <p className="tier2-photo-error">⚠️ {error}</p>}
    </div>
  );
}
