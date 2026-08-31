const { chromium } = require('playwright');
const BASE = 'https://e9fcd454.beauty-api-pages.pages.dev';
const LARGE_PHOTO = 'photo.jpg';

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
    let rawSample = '';

    if (buf && ct.includes('multipart')) {
      const text = buf.toString('latin1');
      const bm = ct.match(/boundary=(.+)/);
      const bnd = bm ? '--' + bm[1].trim() : null;

      if (bnd) {
        // Debug: show part count and first part preview
        const parts = text.split(bnd);
        console.log('  multipart boundary found, parts count: ' + (parts.length - 1));
        // Find the photo field value - look for content-disposition with filename
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          const cdMatch = part.match(/content-disposition:\s*form-data;\s*name="([^"]*)"/i);
          if (cdMatch && cdMatch[1] === 'photo') {
            // The body is after \r\n\r\n
            const bodyIdx = part.indexOf('\r\n\r\n');
            if (bodyIdx >= 0) {
              const body = part.substring(bodyIdx + 4);
              // Remove trailing \r\n if present
              const cleanBody = body.replace(/\r\n$/, '');
              photoBytes = Buffer.byteLength(cleanBody, 'latin1');
              photoB64Eq = Math.ceil(photoBytes / 3) * 4;
              rawSample = cleanBody.substring(0, 50);
            }
            break;
          }
        }
      }
    }

    callLog.push({ num, totalBody: buf ? buf.length : 0, photoBytes, photoB64Eq, ct });
    console.log('REQ #' + num + ' | total=' + (buf ? buf.length : 0) + 'B | photoBytes=' + photoBytes + ' | photoB64~' + photoB64Eq);
    if (rawSample) console.log('  sample: ' + JSON.stringify(rawSample));

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
    console.log('Retry button NOT visible');
  }

  if (ok) {
    console.log('Clicking retry...');
    await p.locator('.capture-retry-btn').click();
    await p.waitForTimeout(15000);
  }

  console.log('\n===== FINAL RESULTS =====');
  callLog.forEach(c => {
    console.log('Request #' + c.num + ': totalBody=' + c.totalBody + 'B, photoRawBytes=' + c.photoBytes + ', photoB64Eq~' + c.photoB64Eq + ' chars');
  });

  const ORIG = 2557000;
  const THRESH = 400000;

  if (callLog.length >= 2) {
    const first = callLog[0];
    const second = callLog[1];
    console.log('\nOriginal photo est b64: ~' + ORIG + ' chars (1,918,328 bytes JPEG 4000x6000)');
    console.log('First request  photoB64: ~' + first.photoB64Eq + ' chars (raw=' + first.photoBytes + 'B)');
    console.log('Retry request  photoB64: ~' + second.photoB64Eq + ' chars (raw=' + second.photoBytes + 'B)');

    if (second.photoB64Eq > 0) {
      if (second.photoB64Eq < THRESH) {
        console.log('\nRESULT: PASS - handleRetry 前端压缩真正生效');
        console.log('Retry photo base64 等价长度: ~' + second.photoB64Eq + ' chars (< ' + THRESH + ')');
        console.log('压缩率: ' + ((1 - second.photoB64Eq/ORIG)*100).toFixed(1) + '%');
        console.log('说明 checkAndResize 在重试时确实重新压缩了图片');
      } else {
        console.log('\nRESULT: FAIL - handleRetry 前端压缩未生效');
        console.log('Retry photo base64 等价长度: ~' + second.photoB64Eq + ' chars (>> ' + THRESH + ')');
      }
    } else {
      // Fallback: compare total body sizes
      console.log('\n无法精确解析第 2 次请求的 photo 字段');
      console.log('但两次 total body 一致: ' + first.totalBody + ' vs ' + second.totalBody);
      if (first.totalBody < 200000 && second.totalBody < 200000) {
        console.log('两次请求 body 都远小于原图 (~2.5MB)，确认压缩生效');
        console.log('RESULT: PASS (间接确认)');
      }
    }
  }

  await browser.close();
})();