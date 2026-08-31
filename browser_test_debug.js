const { chromium } = require('playwright');
const BASE = 'http://localhost:8788';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();

  const requests = [];
  p.on('request', req => {
    if (req.url().includes('tier1/analyze')) {
      requests.push({ url: req.url(), method: req.method(), ts: Date.now(), postDataLen: (req.postData() || '').length });
      console.log('REQ:', req.url(), 'size:', (req.postData() || '').length);
    }
  });
  p.on('response', resp => {
    if (resp.url().includes('tier1/analyze')) {
      console.log('RES:', resp.url(), resp.status());
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
  console.log('Reg:', regRes);
  await p.evaluate(t => localStorage.setItem('session_token', t), regRes.sessionId);

  await p.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  console.log('Uploading large photo...');
  await p.locator('input[type="file"]').setInputFiles('C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg');
  await p.waitForTimeout(5000);

  console.log('Total analyze requests:', requests.length);
  requests.forEach((r, i) => console.log('  [' + i + ']', r.url, 'postDataLen:', r.postDataLen));

  const stage = await p.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-analyzing')) return 'analyzing';
    if (document.querySelector('.capture-error')) return 'error';
    return 'unknown:' + document.body.innerText.substring(0, 200);
  });
  console.log('Stage:', stage);

  await p.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/retry_debug.png' });
  await browser.close();
})();
