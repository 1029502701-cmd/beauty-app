/** 检测是否在 Capacitor 原生环境 */
function isNativeCapacitor() {
  try {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * 获取当前用户的邀请码
 * @param {string} token session token
 * @returns {Promise<{inviteCode:string, invitedCount:number}|null>}
 */
export async function fetchInviteInfo(token) {
  if (!token) return null;
  const res = await fetch('/api/invite/mine', {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  if (!data.inviteCode) return null;
  return { inviteCode: data.inviteCode, invitedCount: data.invitedCount ?? 0 };
}

/**
 * 合成分享图：把二维码绘制到模板图的虚线框位置
 * 模板图坐标（1024×1536）：虚线框中心 (516, 1340)，框内区 x:416..617 y:1241..1439
 * @param {string} inviteCode 邀请码
 * @returns {Promise<Blob>} 合成后的 PNG Blob
 */
export async function composeShareCard(inviteCode) {
  const QRCode = await import('qrcode');
  const inviteUrl = 'https://auth.meijian.top/register?invite=' + encodeURIComponent(inviteCode);

  // 生成二维码到离屏 canvas
  const qr = document.createElement('canvas');
  await QRCode.toCanvas(qr, inviteUrl, {
    width: 200,
    margin: 1,
    color: { dark: '#2d2d2d', light: '#ffffff' },
  });

  // 加载模板图（优先当前源，失败再回退主域名，避免 404/缓存问题）
  const loadTemplate = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('模板图加载失败: ' + url));
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
  const candUrls = ['/share-card-template.jpg'];
  if (window.location.protocol.startsWith('http') && window.location.origin !== 'https://ccfu.ccwu.cc') {
    candUrls.push('https://ccfu.ccwu.cc/share-card-template.jpg');
  }
  let tplImg;
  let lastErr;
  for (const u of candUrls) {
    try { tplImg = await loadTemplate(u); break; } catch (e) { lastErr = e; }
  }
  if (!tplImg) throw lastErr || new Error('模板图加载失败');

  const srcW = tplImg.naturalWidth;
  const srcH = tplImg.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(tplImg, 0, 0, srcW, srcH);

  // 虚线框中心坐标（实测 1024×1536 图）
  const QR_SIZE = 180;
  const QR_X = 516 - QR_SIZE / 2;
  const QR_Y = 1340 - QR_SIZE / 2;

  // 铺白底 + 画二维码
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(QR_X - 8, QR_Y - 8, QR_SIZE + 16, QR_SIZE + 16);
  ctx.drawImage(qr, QR_X, QR_Y, QR_SIZE, QR_SIZE);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('合成失败'))),
      'image/png',
      1.0
    );
  });
}

/**
 * 根据平台分发分享（Capacitor Share / Web Share / 下载）
 * @param {Blob} blob 合成后的图片
 */
export async function shareImage(blob) {
  if (isNativeCapacitor()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const fileName = 'share-card-' + Date.now() + '.png';
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
      title: 'AI美妆',
      text: '扫码注册，解锁你的专属美妆方案',
      url: 'file://' + fileName,
      dialogTitle: '分享到',
    });
  } else {
    try {
      const file = new File([blob], '美妆分享图.png', { type: 'image/png' });
      if (navigator.share) {
        await navigator.share({
          title: 'AI美妆',
          text: '扫码注册，解锁你的专属美妆方案',
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '美妆分享图.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.log('[share] 已取消或不可用:', err);
    }
  }
}
