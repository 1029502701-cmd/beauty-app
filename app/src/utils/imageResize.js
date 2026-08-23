/**
 * 将 File 或 base64 data URL 缩放到满足 DashScope 尺寸要求（512-4096px）
 * 策略：保持宽高比，长边 <= MAX_SIDE，短边 >= MIN_DIM
 */
export const MAX_SIDE = 1024;
export const MIN_DIM = 512;

/**
 * 从 data URL 提取尺寸信息（不渲染图片）
 * 对 JPEG 尝试读取 SOF 标记，否则返回 null
 */
function getDimensionsFromDataUrl(dataUrl) {
  try {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    let offset = 2;
    while (offset < bytes.length - 1) {
      if (bytes[offset] !== 0xFF) { offset++; continue; }
      const marker = bytes[offset + 1];
      const isSOF = (marker >= 0xC0 && marker <= 0xC3) ||
                    (marker >= 0xC5 && marker <= 0xC7) ||
                    (marker >= 0xC9 && marker <= 0xCB) ||
                    (marker >= 0xCD && marker <= 0xCF);
      if (isSOF) {
        const h = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const w = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return { width: w, height: h };
      }
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      offset += 2 + segLen;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * 用 Canvas 缩放图片，返回新的 data URL
 * 处理三种情况：
 *   - 过大：等比缩小，长边 = maxSide
 *   - 过小：等比放大，长边 = maxSide（确保覆盖整个 512-4096px 范围）
 *   - 正常：无需处理
 */
export function resizeImage(fileOrBlob, maxSide = MAX_SIDE, mimeType = 'image/jpeg', quality = 0.9) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = { width: img.naturalWidth, height: img.naturalHeight };
      if (width >= MIN_DIM && height >= MIN_DIM && width <= maxSide && height <= maxSide) {
        // 尺寸已在安全范围内，无需缩放
        resolve(null);
        return;
      }
      // 等比计算新尺寸，长边 = maxSide
      let newWidth, newHeight;
      if (width >= height) {
        newWidth = maxSide;
        newHeight = Math.round((height / width) * maxSide);
      } else {
        newHeight = maxSide;
        newWidth = Math.round((width / height) * maxSide);
      }
      // 防止极端比例导致短边过小（如 100x10000 缩到 1024x10，短边 < 512）
      if (newWidth < MIN_DIM || newHeight < MIN_DIM) {
        // 保证较小边 >= MIN_DIM，确保两维都满足 512px 下限
        const scale = MIN_DIM / Math.min(width, height);
        newWidth = Math.round(width * scale);
        newHeight = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      const resizedDataUrl = canvas.toDataURL(mimeType, quality);
      resolve(resizedDataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

/**
 * 检测图片尺寸是否需要缩放
 * 先尝试快速读取 JPEG 元数据，再用 Canvas 兜底
 */
export async function checkAndResize(file, maxSide = MAX_SIDE) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
  if (typeof dataUrl !== 'string') {
    throw new Error('图片读取结果异常');
  }
  const dims = getDimensionsFromDataUrl(dataUrl);
  if (dims) {
    const { width, height } = dims;
    if (width >= MIN_DIM && height >= MIN_DIM && width <= maxSide && height <= maxSide) {
      return dataUrl; // 尺寸已安全
    }
  }
  const result = await resizeImage(file, maxSide);
  return result !== null ? result : dataUrl;
}