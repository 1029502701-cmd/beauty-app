const { chromium } = require('playwright');
const BASE = 'http://localhost:8788';
const LARGE_PHOTO = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();

  console.log('=== handleRetry 压缩验证（真实 body 大小）===\n');

  // 登录
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const regRes = await p.evaluate(async () => {
    const x = await fetch('/api/auth/login-or-register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13700000095', password: 'TestPass5', confirmPassword: 'TestPass5' })
    });
    return await x.json();
  });
  await p.evaluate(t => localStorage.setItem('session_token', t), regRes.sessionId);

  await p.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  // 在页面中直接调用 checkAndResize，测量压缩后的大小
  const compressInfo = await p.evaluate(async ({ photoPath, BASE }) => {
    // 通过 file input 读取文件并测量
    return { info: 'need_file_input' };
  }, {});

  // 实际测量：先上传，在页面内测量 preview 的 base64 长度
  console.log('[1] 上传大照片 (4000x6000)，同时测量 preview base64 长度...');
  
  let previewB64Len = null;
  p.on('request', req => {
    if (req.url().includes('tier1/analyze')) {
      const buf = req.postDataBuffer();
      if (buf) console.log('  请求 body 大小:', buf.length, 'bytes');
    }
  });
  p.on('response', resp => {
    if (resp.url().includes('tier1/analyze')) {
      console.log('  响应状态:', resp.status());
    }
  });

  await p.locator('input[type="file"]').setInputFiles(LARGE_PHOTO);
  await p.waitForTimeout(2000);
  
  // 在上传后，立即测量 preview 的 base64 长度
  previewB64Len = await p.evaluate(() => {
    const img = document.querySelector('.capture-preview-img');
    if (img && img.src.startsWith('data:')) {
      const commaIdx = img.src.indexOf(',');
      return commaIdx > 0 ? img.src.substring(commaIdx + 1).length : 0;
    }
    return null;
  });
  console.log('  preview 图片 base64 长度:', previewB64Len);
  
  // 测量实际的 API 请求 body 大小（通过拦截最后一次请求）
  const callBodies = [];
  await p.route('**/api/tier1/analyze', async (route) => {
    const buf = route.request().postDataBuffer();
    callBodies.push(buf ? buf.length : 0);
    console.log('  API 请求 body: ' + (buf ? buf.length : 0) + ' bytes');
    await route.continue();
  });

  const stage1 = await p.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-error')) return 'error';
    return 'analyzing';
  });
  console.log('  首次上传阶段:', stage1);

  // 如果 error，点重试并测量
  if (stage1 === 'error') {
    console.log('\n[2] 点击重试...');
    await p.locator('.capture-retry-btn').click();
    await p.waitForTimeout(15000);
    
    const stage2 = await p.evaluate(() => {
      if (document.querySelector('.capture-done')) return 'done';
      if (document.querySelector('.capture-error')) return 'error';
      return 'analyzing';
    });
    console.log('  重试后阶段:', stage2);
  }

  console.log('\n=== 结果汇总 ===');
  console.log('原图文件大小: 1,918,328 bytes (4000x6000 JPEG)');
  console.log('原图 base64 估算: ~2,557,000 chars');
  console.log('preview base64 长度:', previewB64Len);
  console.log('API 请求数:', callBodies.length);
  callBodies.forEach((b, i) => console.log('  请求 ' + (i+1) + ': ' + b + ' bytes'));
  
  if (previewB64Len !== null) {
    if (previewB64Len < 400_000) {
      console.log('\n✅ preview 已经是压缩后的尺寸 (< 400K chars)');
    } else {
      console.log('\n⚠️ preview base64 仍然很大 (' + previewB64Len + ')，压缩可能未生效');
    }
  }

  await p.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/retry_verify2.png' });
  await browser.close();
})();
