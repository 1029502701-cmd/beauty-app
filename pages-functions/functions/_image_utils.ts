// 图片尺寸校验和自动缩放工具（用于 DashScope wanx2.1-imageedit）
// DashScope 要求：宽/高均在 512-4096px 之间

const MIN_DIM = 512;
const MAX_SIDE = 2048; // 后端宽松限制，长边 <= 2048px

/**
 * 从 JPEG 字节流中快速读取宽高（无需完整解码）
 * 返回 { width, height } 或 null
 */
export function readJpegDimensions(buf: ArrayBuffer): { width: number; height: number } | null {
  const bytes = new Uint8Array(buf);
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
  return null;
}

/**
 * 等比计算目标尺寸：长边对齐 targetSide
 * 并保证短边 >= minWidth，否则以 minWidth 为目标长边再次计算
 */
function calcTargetDims(w: number, h: number, targetSide: number, minWidth: number): { newW: number; newH: number } | null {
  let newW: number, newH: number;
  if (w >= h) {
    newW = targetSide;
    newH = Math.round((h / w) * targetSide);
  } else {
    newH = targetSide;
    newW = Math.round((w / h) * targetSide);
  }
  if (newW < minWidth || newH < minWidth) {
    // 保证较小边 >= minWidth，确保两维都满足下限
    const scale = minWidth / Math.min(w, h);
    newW = Math.round(w * scale);
    newH = Math.round(h * scale);
  }
  return { newW, newH };
}

/**
 * 用 Cloudflare Workers Canvas API 将 base64 data URL 缩放到安全尺寸
 * 处理：过大则缩小（长边=maxWidth），过小则放大（长边=maxSide）
 */
export async function resizeBase64IfNeeded(
  dataUrl: string,
  maxWidth = MAX_SIDE,
  minWidth = MIN_DIM
): Promise<string> {
  const commaIdx = dataUrl.indexOf(',');
  const rawB64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binaryStr = Array.from(atob(rawB64), c => c.charCodeAt(0));
  const uint8 = new Uint8Array(binaryStr);

  const dims = readJpegDimensions(uint8.buffer as ArrayBuffer);
  if (dims) {
    const { width, height } = dims;
    if (width >= minWidth && height >= minWidth && width <= maxWidth && height <= maxWidth) {
      return dataUrl; // 尺寸已安全
    }
  }

  const _global = globalThis as Record<string, unknown>;
  const CanvasCtor = _global['createCanvas'] || _global['Canvas'];
  if (!CanvasCtor) {
    console.log('[resizeBase64] Canvas not available, skipping resize');
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width >= minWidth && height >= minWidth && width <= maxWidth && height <= maxWidth) {
        resolve(dataUrl);
        return;
      }
      // 过大：缩小到长边=maxWidth；过小：放大到长边=maxWidth
      const dims = calcTargetDims(width, height, maxWidth, minWidth);
      if (!dims) {
        resolve(dataUrl);
        return;
      }
      const { newW, newH } = dims;
      try {
        const canvas = new (CanvasCtor as new (w: number, h: number) => { toDataURL: (t: string, q: number) => string; getContext: (c: string) => { drawImage: (a: any, x: number, y: number, w: number, h: number) => void; } })(newW, newH);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, newW, newH);
        resolve((canvas as { toDataURL: (t: string, q: number) => string }).toDataURL('image/jpeg', 0.92));
      } catch (e) {
        console.error('[resizeBase64] Canvas error:', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      console.error('[resizeBase64] Image load error');
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

export function logImageDims(buf: ArrayBuffer): void {
  const dims = readJpegDimensions(buf);
  if (dims) {
    console.log(`[image] dimensions: ${dims.width}x${dims.height}`);
  } else {
    console.log('[image] dimensions: unknown');
  }
}