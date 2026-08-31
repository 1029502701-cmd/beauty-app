const { chromium } = require('playwright');
(async () => {
  const BASE = 'https://a5cfbd91.beauty-api-pages.pages.dev';
  console.log('=== Ad Unlock E2E Test (v2) ===\n');

  const token = '19b58e9c-74a4-413a-84a7-30d1173a32e7';
  const reportId = '5264a1b2-4d28-4612-ade5-f04b838c2fcf';

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  await context.addInitScript((t) => localStorage.setItem('session_token', t), token);
  const page = await context.newPage();

  const tier2Reqs = [];
  page.on('request', (req) => {
    if (req.url().includes('tier2/status') && req.method() === 'GET') {
      tier2Reqs.push({ t: Date.now(), url: req.url() });
    }
  });
  page.on('pageerror', err => console.log('[JS ERROR]', err.message));

  console.log('Navigating to /report?tab=进阶...');
  await page.goto(BASE + '/report?id=' + reportId + '&tab=%E8%BF%9B%E9%98%B6', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url().replace(BASE, ''));

  // Check state before clicking
  const stateBefore = await page.evaluate(() => ({
    processing: document.querySelector('.report-loading p')?.textContent || 'none',
    hasCoreCard: document.querySelector('.report-core-card') !== null,
    hasOverlay: document.querySelector('.tier2-ad-overlay') !== null,
    unlockBtnText: document.querySelector('button')?.textContent?.trim() || 'none'
  }));
  console.log('State before click:', JSON.stringify(stateBefore));

  // Click unlock button
  const unlockBtn = page.locator('button:has-text("看广告解锁")').first();
  console.log('\n--- Clicking unlock button ---');
  await unlockBtn.click();
  
  // Wait and check
  await page.waitForTimeout(1000);
  const stateAfterClick = await page.evaluate(() => ({
    processing: document.querySelector('.report-loading p')?.textContent || 'none',
    hasCoreCard: document.querySelector('.report-core-card') !== null,
    hasOverlay: document.querySelector('.tier2-ad-overlay') !== null,
    adUnlockLoading: document.querySelector('button:has-text("解锁中")') !== null
  }));
  console.log('State after click (1s):', JSON.stringify(stateAfterClick));

  // Wait for ad to complete (5s duration)
  console.log('Waiting for ad (7s)...');
  await page.waitForTimeout(7000);

  const stateAfterAd = await page.evaluate(() => ({
    processing: document.querySelector('.report-loading p')?.textContent || 'none',
    hasCoreCard: document.querySelector('.report-core-card') !== null,
    hasOverlay: document.querySelector('.tier2-ad-overlay') !== null,
    url: window.location.pathname
  }));
  console.log('State after ad (7s):', JSON.stringify(stateAfterAd));
  console.log('tier2/status requests so far:', tier2Reqs.length);
  
  await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_v2_after_ad.png', fullPage: true });

  if (stateAfterAd.processing.includes('AI 正在生成')) {
    console.log('\nPolling for completion (60s max)...');
    try {
      await page.waitForSelector('.report-core-card', { timeout: 60000 });
      console.log('\nSUCCESS: Content appeared!');
      await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_v2_ready.png', fullPage: true });
      console.log('Total tier2/status requests:', tier2Reqs.length);
      if (tier2Reqs.length > 0) {
        const times = tier2Reqs.map(r => Math.round(r.t - tier2Reqs[0].t));
        console.log('Request intervals (ms):', times.join(', '));
      }
    } catch {
      console.log('\nTIMEOUT: Stuck in processing');
      console.log('Total tier2/status requests:', tier2Reqs.length);
      if (tier2Reqs.length > 0) {
        const times = tier2Reqs.map(r => Math.round(r.t - tier2Reqs[0].t));
        console.log('Request intervals (ms):', times.join(', '));
      }
      await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_v2_stuck.png', fullPage: true });
    }
  } else if (stateAfterAd.hasCoreCard) {
    console.log('\nContent visible after ad!');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_v2_ready.png', fullPage: true });
  } else {
    console.log('\nUnexpected state - taking screenshot');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_v2_unexpected.png', fullPage: true });
  }

  await browser.close();
  console.log('\n=== Test Complete ===');
})();
