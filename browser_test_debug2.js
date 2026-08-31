const { chromium } = require('playwright');
const BASE = 'http://localhost:8788';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();

  const analyzeCalls = [];
  
  // 拦截请求，记录完整的 multipart body
  await p.route('**/api/tier1/analyze', async (route) => {
    const req = route.request();
    const method = req.method();
    const url = req.url();
    const contentType = req.headers()['content-type'] || '';
    
    let bodyStr = null;
    let bodyLen = 0;
    try {
      const buf = req.postDataBuffer();
      if (buf) {
        bodyStr = buf.toString('utf8');
        bodyLen = bodyStr.length;
      }
    } catch(e) {}
    
    analyzeCalls.push({ method, url, contentType, bodyLen, hasB64: bodyStr && bodyStr.includes('data:image') });
    console.log('INTERCEPTED:', url, 'method:', method, 'bodyLen:', bodyLen, 'hasB64:', !!bodyStr?.includes('data:image'));
    
    if (analyzeCalls.length === 1) {
      // 第一次：返回500触发错误状态
      console.log('  -> 返回500 (模拟失败)');
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'mock error' }) });
    } else {
      console.log('  -> 放行到真实后端');
      await route.continue();
    }
  });

  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  const regRes = await p.evaluate(async () => {
    const x = await fetch('/api/auth/login-or-register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13700000099', password: 'TestPass1', confirmPassword: 'TestPass1' })
    });
    return await x.json();
  });
  await p.evaluate(t => localStorage.setItem('session_token', t), regRes.sessionId);

  await p.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  console.log('\nUploading large photo (4000x6000)...');
  await p.locator('input[type="file"]').setInputFiles('C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg');
  
  // 等待第一次请求被拦截 + 错误状态出现
  console.log('Waiting for error state (first call mocked to 500)...');
  await p.waitForTimeout(3000);
  
  const afterUpload = await p.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-analyzing')) return 'analyzing';
    if (document.querySelector('.capture-error')) return 'error';
    return 'unknown';
  });
  console.log('Stage after upload:', afterUpload);
  console.log('Analyze calls so far:', analyzeCalls.length);
  analyzeCalls.forEach((c, i) => console.log('  ['+i+'] bodyLen:', c.bodyLen, 'hasB64:', c.hasB64));

  if (afterUpload === 'error') {
    console.log('\nClicking retry...');
    await p.locator('.capture-retry-btn').click();
    console.log('Waiting for second request...');
    await p.waitForTimeout(10000);
  }

  console.log('\nFinal analyze calls:', analyzeCalls.length);
  analyzeCalls.forEach((c, i) => {
    console.log('  ['+i+'] bodyLen:', c.bodyLen, 'hasB64:', c.hasB64);
    if (c.hasB64 && c.bodyLen > 0) {
      const idx = c.bodyStr?.indexOf('base64,');
      if (idx >= 0) {
        const b64len = c.bodyStr.length - idx - 7;
        console.log('    -> photo base64 length:', b64len);
      }
    }
  });

  const finalStage = await p.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-analyzing')) return 'analyzing';
    if (document.querySelector('.capture-error')) return 'error';
    return 'unknown';
  });
  console.log('Final stage:', finalStage);

  await p.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/retry_debug2.png' });
  await browser.close();
})();
