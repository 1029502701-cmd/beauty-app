const { chromium } = require('playwright');
(async () => {
  const BASE = 'https://a5cfbd91.beauty-api-pages.pages.dev';
  console.log('=== Ad Unlock E2E Test ===\n');

  // Use existing token
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
  await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_start.png', fullPage: true });

  // Check state
  const hasUnlockBtn = await page.locator('button:has-text("看广告解锁")').count();
  const hasContent = await page.locator('.report-core-card').count();
  const hasProcessing = await page.locator('.report-loading p:has-text("AI 正在生成进阶报告")').count();
  console.log('Unlock:', hasUnlockBtn, '| Content:', hasContent, '| Processing:', hasProcessing);

  if (hasUnlockBtn > 0) {
    console.log('\n--- Clicking 看广告解锁 ---');
    await page.locator('button:has-text("看广告解锁")').click();
    await page.waitForTimeout(2000);

    const adVisible = await page.locator('.tier2-ad-overlay').count();
    console.log('Ad overlay visible:', adVisible > 0);
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_ad.png', fullPage: true });

    if (adVisible > 0) {
      console.log('\nWaiting for ad to complete (6s)...');
      await page.waitForTimeout(6000);

      const afterAdProc = await page.locator('.report-loading p:has-text("AI 正在生成进阶报告")').count();
      const afterAdContent = await page.locator('.report-core-card').count();
      console.log('After ad - Processing:', afterAdProc, '| Content:', afterAdContent);
      console.log('tier2/status requests so far:', tier2Reqs.length);
      await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_after_ad.png', fullPage: true });

      if (afterAdProc > 0 && afterAdContent === 0) {
        console.log('\nPolling for completion (60s max)...');
        try {
          await page.waitForSelector('.report-core-card', { timeout: 60000 });
          console.log('\nSUCCESS: Tier2 content appeared!');
          await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_ready.png', fullPage: true });
          console.log('Total tier2/status requests:', tier2Reqs.length);
          if (tier2Reqs.length > 0) {
            const times = tier2Reqs.map(r => Math.round(r.t - tier2Reqs[0].t));
            console.log('Request intervals (ms from first):', times.join(', '));
          }
        } catch {
          console.log('\nTIMEOUT: Still stuck in processing after 60s');
          console.log('Total tier2/status requests:', tier2Reqs.length);
          if (tier2Reqs.length > 0) {
            const times = tier2Reqs.map(r => Math.round(r.t - tier2Reqs[0].t));
            console.log('Request intervals (ms):', times.join(', '));
          }
          await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_stuck.png', fullPage: true });
        }
      } else if (afterAdContent > 0) {
        console.log('\nContent visible immediately after ad!');
        await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_ready.png', fullPage: true });
      } else {
        console.log('\nUnexpected state after ad');
        const state = await page.evaluate(() => ({
          processing: document.querySelector('.report-loading p')?.textContent || 'none',
          hasCoreCard: document.querySelector('.report-core-card') !== null,
          hasOverlay: document.querySelector('.tier2-ad-overlay') !== null
        }));
        console.log('State:', JSON.stringify(state));
        await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_state.png', fullPage: true });
      }
    } else {
      console.log('No ad overlay - checking state');
      const state = await page.evaluate(() => ({
        processing: document.querySelector('.report-loading p')?.textContent || 'none',
        hasCoreCard: document.querySelector('.report-core-card') !== null,
        hasOverlay: document.querySelector('.tier2-ad-overlay') !== null,
        hasUnlock: document.querySelector('button:has-text("看广告解锁")') !== null
      }));
      console.log('State:', JSON.stringify(state));
      await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_no_overlay.png', fullPage: true });
    }
  } else if (hasContent > 0) {
    console.log('\nContent already visible!');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_already.png', fullPage: true });
  } else {
    console.log('\nNo unlock button and no content - checking all buttons');
    const btns = await page.locator('button').allTextContents();
    console.log('Buttons:', btns.filter(t => t.trim()));
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\ad_unlock_all.png', fullPage: true });
  }

  await browser.close();
  console.log('\n=== Test Complete ===');
})();
