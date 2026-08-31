const { chromium } = require('playwright');
const BASE = 'http://localhost:8788';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();

  const analyzeCalls = [];
  
  // 只做日志记录，不拦截
  await p.route('**/api/tier1/analyze', async (route) => {
    const req = route.request();
    let bodyStr = null;
    let bodyLen = 0;
    try {
      const buf = req.postDataBuffer();
      if (buf) {
        bodyStr = buf.toString('utf8');
        bodyLen = bodyStr.length;
      }
    } catch(e) {}
    
    // 提取 multipart 中的 base64 数据
    let b64Len = 0;
    if (bodyStr) {
      // 在 multipart body 中找 data:image/jpeg;base64, 后面的内容
      const marker = 'data:image';
      let idx = bodyStr.indexOf(marker);
      if (idx >= 0) {
        const b64Start = bodyStr.indexOf(',', idx) + 1;
        b64Len = bodyStr.length - b64Start;
      }
    }
    
    analyzeCalls.push({ bodyLen, b64Len, hasMarker: bodyStr && bodyStr.includes('data:image') });
    console.log('CALL #' + (analyzeCalls.length) + ': totalBody=' + bodyLen + ', b64portion=' + b64Len + ', hasDataUrl=' + !!analyzeCalls[analyzeCalls.length-1].hasMarker);
    
    await route.continue();
  });

  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  const regRes = await p.evaluate(async () => {
    const x = await fetch('/api/auth/login-or-register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13700000098', password: 'TestPass2', confirmPassword: 'TestPass2' })
    });
    return await x.json();
  });
  console.log('Reg:', regRes.sessionId ? 'OK' : 'FAIL');
  await p.evaluate(t => localStorage.setItem('session_token', t), regRes.sessionId);

  await p.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  console.log('\n--- TEST A: 首次上传大照片 (无拦截) ---');
  await p.locator('input[type="file"]').setInputFiles('C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg');
  await p.waitForTimeout(15000);
  
  console.log('\nStage:', await p.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-analyzing')) return 'analyzing';
    if (document.querySelector('.capture-error')) return 'error';
    return 'unknown';
  }));
  console.log('Calls so far:', analyzeCalls.length);
  analyzeCalls.forEach((c,i) => console.log('  ['+i+'] totalBody=' + c.bodyLen + ' b64portion=' + c.b64Len));

  // 如果 error 状态出现，点重试
  const stage = await p.evaluate(() => {
    if (document.querySelector('.capture-error')) return 'error';
    if (document.querySelector('.capture-done')) return 'done';
    return 'other';
  });
  
  if (stage === 'error') {
    console.log('\n--- TEST B: 点击重试按钮 ---');
    await p.locator('.capture-retry-btn').click();
    await p.waitForTimeout(15000);
    console.log('Stage after retry:', await p.evaluate(() => {
      if (document.querySelector('.capture-done')) return 'done';
      if (document.querySelector('.capture-analyzing')) return 'analyzing';
      if (document.querySelector('.capture-error')) return 'error';
      return 'unknown';
    }));
  }

  console.log('\n=== FINAL RESULTS ===');
  console.log('Total analyze calls:', analyzeCalls.length);
  analyzeCalls.forEach((c, i) => {
    console.log('  Call ' + (i+1) + ': totalBody=' + c.bodyLen + ', b64portion=' + c.b64Len + ', hasDataUrl=' + c.hasMarker);
  });
  
  if (analyzeCalls.length >= 2) {
    const first = analyzeCalls[0];
    const second = analyzeCalls[1];
    console.log('\n对比:');
    console.log('  首次上传 b64 portion:', first.b64Len);
    console.log('  重试上传 b64 portion:', second.b64Len);
    if (second.b64Len <= first.b64Len * 1.1) {
      console.log('  ✅ 重试与首次 body 大小相近，前端压缩生效');
    } else {
      console.log('  ❌ 重试 body 显著大于首次，前端压缩可能未生效');
    }
  }

  await p.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/retry_debug3.png' });
  await browser.close();
})();
