const { chromium } = require('playwright');
const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 8788, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  const token = '89066595-93f5-432b-b759-6f625e1d713a';
  await page.addInitScript((t) => {
    localStorage.setItem('session_token', t);
    sessionStorage.setItem('session_token', t);
  }, token);

  console.log('[PW] Step 1: Navigate to report');
  await page.goto('http://localhost:8788/report?id=115e3319-9237-4ee6-ad3f-3b6e7343e364&tab=' + unescape('%E8%BF%AD%E9%98%80'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('[PW] URL:', page.url());

  if (page.url().includes('set-password')) {
    console.log('[PW] On set-password page');
    await page.screenshot({ path: 'pw_sp_before.png', fullPage: false });
    const pwdInputs = await page.('input[type=password]');
    console.log('[PW] Pwd inputs:', pwdInputs.length);
    for (const inp of pwdInputs) { await inp.fill('test123456'); }
    await page.locator('button[type=submit]').click().catch(async () => {
      await page.locator('button').filter({ hasText: '保存' }).first().click();
    });
    await page.waitForTimeout(2000);
    await page.goto('http://localhost:8788/report?id=115e3319-9237-4ee6-ad3f-3b6e7343e364&tab=' + unescape('%E8%BF%AD%E9%98%80'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
  }

  console.log('[PW] Final URL:', page.url());
  await page.screenshot({ path: 'pw_share_1_start.png', fullPage: false });
  console.log('[PW] Screenshot: pw_share_1_start.png');

  if (!page.url().includes('report')) {
    console.log('[PW] ERROR: Not on report page');
    await browser.close();
    process.exit(1);
  }

  const unlockBtns = page.locator('button');
  const allBtnTexts = await unlockBtns.allTextContents();
  const hasShareBtn = allBtnTexts.some(t => t.includes('分享解锁') || t.includes('去分享解锁'));
  const contentCount = await page.locator('.report-core-card').count();
  console.log('[PW] Has share button:', hasShareBtn, '| Content:', contentCount);
  console.log('[PW] All buttons:', allBtnTexts.join(' | '));

  if (hasShareBtn) {
    console.log('[PW] Step 2: Click share unlock');
    const shareBtn = unlockBtns.filter({ hasText: '分享解锁' }).first();
    await shareBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'pw_share_2_clicked.png', fullPage: false });
    console.log('[PW] Screenshot: pw_share_2_clicked.png');

    const loadingText = await page.locator('.report-loading p').textContent().catch(() => 'none');
    console.log('[PW] Loading text:', loadingText);

    console.log('[PW] Step 3: Waiting for generation (max 60s)...');
    try {
      await page.waitForSelector('.report-core-card', { timeout: 60000 });
      console.log('[PW] SUCCESS! Content loaded');
      await page.screenshot({ path: 'pw_share_3_ready.png', fullPage: false });
      console.log('[PW] Screenshot: pw_share_3_ready.png');

      const coreMakeup = await page.locator('.report-core-text').textContent().catch(() => 'none');
      const keyAreas = await page.locator('.report-area-text').allTextContents();
      const prodNames = await page.locator('.report-product-name').allTextContents();
      console.log('[PW] Core makeup:', coreMakeup.substring(0, 80));
      console.log('[PW] Key areas:', keyAreas.length);
      console.log('[PW] Products:', prodNames.length);
      for (let i = 0; i < keyAreas.length; i++) {
        console.log('[PW]   Area ' + (i+1) + ':', keyAreas[i].substring(0, 60));
      }
    } catch {
      console.log('[PW] TIMEOUT');
      await page.screenshot({ path: 'pw_share_3_timeout.png', fullPage: false });
    }
  } else if (contentCount > 0) {
    console.log('[PW] Content already visible');
    await page.screenshot({ path: 'pw_share_1_ready.png', fullPage: false });
  } else {
    console.log('[PW] Unexpected - no share btn, no content');
    await page.screenshot({ path: 'pw_share_1_unknown.png', fullPage: false });
  }

  await browser.close();
  console.log('[PW] DONE');
})();
