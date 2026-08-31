const { chromium } = require('playwright');
const BASE = 'http://localhost:8788';
const LARGE_PHOTO = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const p = await browser.newPage();

  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const regRes = await p.evaluate(async () => {
    const x = await fetch('/api/auth/login-or-register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13700000094', password: 'TestPass6', confirmPassword: 'TestPass6' })
    });
    return await x.json();
  });
  await p.evaluate(t => localStorage.setItem('session_token', t), regRes.sessionId);

  await p.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  const callLog = [];

  await p.route('**/api/tier1/analyze', async (route) => {
    const req = route.request();
    const buf = req.postDataBuffer();
    const ct = req.headers()['content-type'] || '';
    const num = callLog.length + 1;

    let photoBytes = 0;
    let photoB64Eq = 0;

    if (buf && ct.includes('multipart')) {
      const text = buf.toString('latin1');
      const bm = ct.match(/boundary=(.+)/);
      const bnd = bm ? '--' + bm[1].trim() : null;
      if (bnd) {
        const parts = text.split(bnd);
        const part = parts[num] || '';
        const m = part.match(/\r\n\r\n([\s\S]*?)(?=\r\n--|$)/);
        if (m) {
          photoBytes = Buffer.byteLength(m[1], 'latin1');
          photoB64Eq = Math.ceil(photoBytes / 3) * 4;
        }
      }
    }

    callLog.push({ num, totalBody: buf ? buf.length : 0, photoBytes, photoB64Eq, ct });
    console.log('REQ #' + num + ' | total=' + (buf ? buf.length : 0) + 'B | photoRaw=' + photoBytes + 'B | photoB64~' + photoB64Eq + 'chars');

    if (num === 1) {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'mock fail' }) });
      console.log('  -> mock 500, trigger retry');
    } else {
      await route.continue();
      console.log('  -> pass to real backend');
    }
  });

  console.log('Uploading large photo...');
  await p.locator('input[type="file"]').setInputFiles(LARGE_PHOTO);
  await p.waitForTimeout(3000);

  let ok = false;
  try {
    await p.locator('.capture-retry-btn').waitFor({ state: 'visible', timeout: 8000 });
    ok = true;
    console.log('Retry button visible');
  } catch(e) {
    console.log('Retry button NOT visible, stage = ' + await p.evaluate(() => document.querySelector('.capture-done, .capture-error, .capture-analyzing')?.className || 'unknown'));
  }

  if (ok) {
    console.log('Clicking retry...');
    await p.locator('.capture-retry-btn').click();
    await p.waitForTimeout(15000);
  }

  console.log('\n===== RESULTS =====');
  callLog.forEach(c => {
    console.log('  Request #' + c.num + ': totalBody=' + c.totalBody + 'B, photoRaw=' + c.photoBytes + 'B, photoB64~' + c.photoB64Eq + ' chars');
  });

  const ORIG = 2557000;
  const THRESH = 400000;

  if (callLog.length >= 2) {
    const s = callLog[1];
    console.log('\nOriginal photo est b64: ~' + ORIG + ' chars');
    if (s.photoB64Eq > 0) {
      if (s.photoB64Eq < THRESH) {
        console.log('RESULT: PASS - handleRetry compression WORKING');
        console.log('Retry photo base64 equivalent: ~' + s.photoB64Eq + ' chars (< ' + THRESH + ')');
        console.log('Compression ratio: ' + ((1 - s.photoB64Eq/ORIG)*100).toFixed(1) + '%');
      } else {
        console.log('RESULT: FAIL - handleRetry compression NOT working');
        console.log('Retry photo base64 equivalent: ~' + s.photoB64Eq + ' chars (>> ' + THRESH + ')');
      }
    } else {
      console.log('Could not parse multipart. Using total body: ' + s.totalBody + 'B');
      if (s.totalBody < 200000) {
        console.log('RESULT: PASS (indirect) - body much smaller than original ~2.5MB');
      } else {
        console.log('RESULT: UNCLEAR - body size ' + s.totalBody + 'B needs manual check');
      }
    }
  }

  await browser.close();
})();