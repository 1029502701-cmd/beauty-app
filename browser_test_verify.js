const { chromium } = require('playwright');
const BASE = 'http://localhost:8788';
const LARGE_PHOTO = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg';
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();

  // 方案：在 page.evaluate 中注入自定义 fetch 拦截，直接记录真实 body
  // 同时在外部用 route 拦截记录
  
  console.log('=== 验证 handleRetry 压缩真实性 ===\n');
  
  // 登录
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const regRes = await p.evaluate(async () => {
    const x = await fetch('/api/auth/login-or-register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13700000096', password: 'TestPass4', confirmPassword: 'TestPass4' })
    });
    return await x.json();
  });
  await p.evaluate(t => localStorage.setItem('session_token', t), regRes.sessionId);

  await p.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  // 在页面中注入分析：在 callAnalyze 执行前后记录 blob size
  const results = await p.evaluate(async ({ photoPath, BASE }) => {
    const results = [];
    
    // 读取大照片为 blob
    const resp = await fetch(photoPath);
    const originalBlob = await resp.blob();
    const originalSize = originalBlob.size;
    
    // 模拟 checkAndResize 流程 (与前端一致)
    const { checkAndResize } = await import('/src/utils/imageResize.js');
    // 由于不能直接 import，我们用内联逻辑模拟
    const resizedDataUrl = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1024;
        let newWidth, newHeight;
        if (img.naturalWidth >= img.naturalHeight) {
          newWidth = maxSide;
          newHeight = Math.round((img.naturalHeight / img.naturalWidth) * maxSide);
        } else {
          newHeight = maxSide;
          newWidth = Math.round((img.naturalWidth / img.naturalHeight) * maxSide);
        }
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        canvas.getContext('2d').drawImage(img, 0, 0, newWidth, newHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = URL.createObjectURL(originalBlob);
    });
    
    // 计算 resize 后 base64 长度
    const b64Idx = resizedDataUrl.indexOf(',');
    const b64Part = resizedDataUrl.substring(b64Idx + 1);
    const resizedB64Len = b64Part.length;
    
    // 计算转换成 blob 后的大小
    const byteStr = atob(b64Part);
    const arr = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
    const retryBlob = new Blob([arr], { type: 'image/jpeg' });
    
    // 再次 checkAndResize 模拟 retry 路径
    const finalDataUrl = await new Promise((resolve) => {
      const img2 = new Image();
      img2.onload = () => {
        const maxSide = 1024;
        let newWidth, newHeight;
        if (img2.naturalWidth >= img2.naturalHeight) {
          newWidth = maxSide;
          newHeight = Math.round((img2.naturalHeight / img2.naturalWidth) * maxSide);
        } else {
          newHeight = maxSide;
          newWidth = Math.round((img2.naturalWidth / img2.naturalHeight) * maxSide);
        }
        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        canvas.getContext('2d').drawImage(img2, 0, 0, newWidth, newHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img2.src = resizedDataUrl; // 已经是压缩后的，再压缩一次应该不变
    });
    
    const finalB64Idx = finalDataUrl.indexOf(',');
    const finalB64Part = finalDataUrl.substring(finalB64Idx + 1);
    
    results.push({
      originalFileSize: originalSize,
      originalB64Len: Math.ceil(originalSize * 4/3) + 20, // 近似
      resizedB64Len: b64Part.length,
      finalB64Len: finalB64Part.length,
      sameAfterDoubleResize: b64Part.length === finalB64Part.length,
    });
    
    return results;
  }, { photoPath: LARGE_PHOTO });

  console.log('=== 前端压缩理论计算 ===');
  console.log('原图文件大小:', results[0].originalFileSize, 'bytes');
  console.log('原图 base64 近似长度:', results[0].originalB64Len, 'chars');
  console.log('压缩后 (1024px JPEG 0.9) base64 长度:', results[0].resizedB64Len, 'chars');
  console.log('二次压缩后 base64 长度:', results[0].finalB64Len, 'chars');
  console.log('两次压缩结果一致:', results[0].sameAfterDoubleResize);
  
  // 现在实际测试：首次上传，看请求体大小
  console.log('\n=== 实际浏览器测试 ===');
  
  // 不拦截，让首次请求真实发出
  const actualCalls = [];
  await p.route('**/api/tier1/analyze', async (route) => {
    const req = route.request();
    const buf = req.postDataBuffer();
    const bodyLen = buf ? buf.length : 0;
    actualCalls.push(bodyLen);
    console.log('  请求 #' + actualCalls.length + ': body=' + bodyLen + ' bytes');
    await route.continue();
  });

  await p.locator('input[type="file"]').setInputFiles(LARGE_PHOTO);
  await p.waitForTimeout(15000);
  
  const stage1 = await p.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-error')) return 'error';
    return 'analyzing/unknown';
  });
  console.log('首次上传阶段:', stage1);

  // 如果 error，点重试
  if (stage1 === 'error') {
    console.log('\n点击重试...');
    await p.locator('.capture-retry-btn').click();
    await p.waitForTimeout(15000);
    const stage2 = await p.evaluate(() => {
      if (document.querySelector('.capture-done')) return 'done';
      if (document.querySelector('.capture-error')) return 'error';
      return 'analyzing/unknown';
    });
    console.log('重试后阶段:', stage2);
  }

  console.log('\n=== 结论 ===');
  console.log('实际请求数:', actualCalls.length);
  actualCalls.forEach((c, i) => console.log('  请求 ' + (i+1) + ': ' + c + ' bytes'));
  
  if (actualCalls.length >= 1) {
    const firstBody = actualCalls[0];
    // 原图 1.9MB → base64 ≈ 255万字符，multipart 约 255万+boundary
    // 压缩后 1024px JPEG 0.9 ≈ 50-150KB，multipart 约 50-150K+boundary
    const originalEstimate = Math.ceil(results[0].originalFileSize * 4/3) + 1000;
    const compressedEstimate = results[0].resizedB64Len + 1000;
    
    console.log('\n原图 multipart 估计大小: ~' + originalEstimate + ' bytes');
    console.log('压缩后 multipart 估计大小: ~' + compressedEstimate + ' bytes');
    console.log('实际首次请求大小: ' + firstBody + ' bytes');
    
    if (firstBody < originalEstimate * 0.5) {
      console.log('\n✅ 首次上传已经经过前端压缩 (body << 原图 base64 大小)');
    } else {
      console.log('\n⚠️ 首次上传可能未压缩');
    }
  }

  await p.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/retry_verify.png' });
  await browser.close();
})();
