const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext()).newPage();
  const token = '89066595-93f5-432b-b759-6f625e1d713a';
  await page.addInitScript(t => { localStorage.setItem('session_token', t); sessionStorage.setItem('session_token', t); }, token);
  const reportId = '115e3319-9237-4ee6-ad3f-3b6e7343e364';
  const base = 'http://localhost:8788/report?id=' + reportId;
  const tab = unescape('%E8%BF%AD%E9%98%80');
  console.log('[PW] Navigate to report');
  await page.goto(base + '&tab=' + tab, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  console.log('[PW] URL:', page.url());
  if (page.url().includes('set-password')) {
    console.log('[PW] On set-password page, filling password');
    const pwdInputs = await page.locator('input[type=password]').all();
    for (const inp of pwdInputs) { await inp.fill('test123456'); }
    try { await page.locator('button').filter({ hasText: /save|bao|保存/i }).first().click(); } catch(e) { await page.locator('button').first().click(); }
    await page.waitForTimeout(2000);
    await page.goto(base + '&tab=' + tab, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }
  const allBtns = await page.locator('button').allTextContents();
  const hasShareBtn = allBtns.some(t => t.includes('\u5206\u4eab\u89e3\u9501') || t.toLowerCase().includes('share'));
  console.log('[PW] Has share button:', hasShareBtn, '| Buttons:', allBtns.join(' | '));
  await page.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/\u7f8e\u7933app/pw_1_start.png', fullPage: false });
  if (!hasShareBtn) {
    const cnt = await page.locator('.report-core-card').count();
    console.log('[PW] No share btn, cards:', cnt);
    await page.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/\u7f8e\u7933app/pw_1_no_share.png', fullPage: false });
    if (cnt > 0) { console.log('[PW] Content already visible!'); await browser.close(); return; }
  }
  if (hasShareBtn) {
    console.log('[PW] Clicking share unlock');
    await page.locator('button').filter({ hasText: /\u5206\u4eab\u89e3\u9501/ }).first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/\u7f8e\u7933app/pw_2_clicked.png', fullPage: false });
    console.log('[PW] Polling for completion (max 90s)');
    const t0 = Date.now(); let ok = false;
    while (Date.now() - t0 < 90000) {
      await page.waitForTimeout(2000);
      const cards = await page.locator('.report-core-card').count();
      const loading = await page.locator('.report-loading').count();
      console.log('[PW] ' + Math.floor((Date.now()-t0)/1000) + 's: cards=' + cards + ' loading=' + loading);
      if (cards > 0 && loading === 0) { ok = true; break; }
    }
    if (ok) {
      console.log('[PW] SUCCESS!');
      await page.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/\u7f8e\u7933app/pw_3_ready.png', fullPage: true });
      const core = await page.locator('.report-core-text').first().textContent().catch(() => 'none');
      const areas = await page.locator('.report-area-text').allTextContents();
      const prods = await page.locator('.report-product-name').allTextContents();
      console.log('[PW] Core makeup:', (core||'').substring(0, 100));
      console.log('[PW] Key areas count:', areas.length);
      console.log('[PW] Product recs count:', prods.length);
      areas.forEach((a,i) => console.log('[PW]   Area ' + (i+1) + ':', a.substring(0,60)));
    } else {
      console.log('[PW] TIMEOUT');
      await page.screenshot({ path: 'C:/Users/yao/Documents/ChatGPT/\u7f8e\u7933app/pw_3_timeout.png', fullPage: true });
    }
  }
  await browser.close();
  console.log('[PW] DONE');
})();
