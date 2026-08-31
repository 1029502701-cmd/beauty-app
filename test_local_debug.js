const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const BASE = 'http://localhost:8788';

  const token = 'c510feeb-e650-4ed7-b369-727c4ceebac6';
  const reportId = 'be72f95f-42fd-48dc-9a1b-4a79a2a92cda';

  await page.addInitScript((t) => localStorage.setItem('session_token', t), token);
  
  const allRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      allRequests.push({ t: Date.now(), method: req.method(), url: req.url().replace(BASE, '') });
    }
  });
  page.on('response', async (resp) => {
    if (resp.url().includes('/api/')) {
      const body = await resp.text().catch(() => '');
      allRequests[allRequests.length-1].status = resp.status();
      allRequests[allRequests.length-1].body = body.substring(0, 200);
    }
  });

  console.log('Navigating to /report?tab=进阶...');
  await page.goto(BASE + '/report?id=' + reportId + '&tab=%E8%BF%9B%E9%98%B6', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url().replace(BASE, ''));

  console.log('\nAll API requests:');
  for (const r of allRequests) {
    console.log('  [' + r.method + '] ' + r.status + ' ' + r.url + ' => ' + r.body);
  }

  const state = await page.evaluate(() => ({
    processing: document.querySelector('.report-loading p')?.textContent || 'none',
    hasCoreCard: document.querySelector('.report-core-card') !== null,
    unlockBtnText: document.querySelector('button')?.textContent?.trim() || 'none'
  }));
  console.log('\nPage state:', JSON.stringify(state));

  // Check what buttons exist
  const btns = await page.locator('button').allTextContents();
  console.log('Buttons:', btns.filter(t => t.trim()).slice(0, 10));

  // Click unlock button if visible
  const hasUnlockBtn = await page.locator('button:has-text("看广告解锁")').count();
  if (hasUnlockBtn > 0) {
    console.log('\nClicking unlock button...');
    await page.locator('button:has-text("看广告解锁")').click();
    await page.waitForTimeout(500);
    
    const stateAfter = await page.evaluate(() => ({
      processing: document.querySelector('.report-loading p')?.textContent || 'none',
      hasCoreCard: document.querySelector('.report-core-card') !== null,
      adLoading: document.querySelector('button:has-text("解锁中")') !== null
    }));
    console.log('After click:', JSON.stringify(stateAfter));
    
    // Wait for generation
    console.log('Waiting for generation (30s)...');
    try {
      await page.waitForSelector('.report-core-card', { timeout: 30000 });
      console.log('SUCCESS: Content appeared!');
    } catch {
      console.log('TIMEOUT: Still processing');
    }
  }

  await browser.close();
  console.log('\n=== Test Complete ===');
})();
