const { chromium } = require('playwright');
(async () => {
  const BASE = 'https://b7e8dcb2.beauty-api-pages.pages.dev';
  console.log('=== Production Test (New Deploy) ===\n');

  // === TEST 1: Login redirect ===
  console.log('--- TEST 1: Login redirect ---');
  
  // Register via Node.js API
  const regRes = await fetch(BASE + '/api/auth/login-or-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '13600000003', password: 'TestPass3', confirmPassword: 'TestPass3' })
  }).then(r => r.json());
  console.log('Register:', JSON.stringify(regRes));
  const token = regRes.sessionId;
  console.log('Token:', token);

  // Create a FRESH browser context WITHOUT any token
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  const navLog = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navLog.push({ t: Date.now(), url: frame.url() });
  });

  console.log('Navigating to /report (unauthenticated, fresh context)...');
  await page.goto(BASE + '/report?id=44ef8170-9176-40f2-ba2b-7aabb6802ada', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('URL after goto:', page.url().replace(BASE, ''));

  if (page.url().includes('/login')) {
    const redirectFrom = await page.evaluate(() => sessionStorage.getItem('auth_redirect_from'));
    console.log('auth_redirect_from:', redirectFrom);

    await page.fill('input[placeholder*="手机号 / 邮箱"]', '13600000003');
    await page.fill('input[placeholder*="请输入密码"]', 'TestPass3');
    await page.fill('input[placeholder*="请再次输入密码"]', 'TestPass3');

    console.log('Clicking login...');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    console.log('Final URL:', finalUrl.replace(BASE, ''));
    console.log('Nav log:', JSON.stringify(navLog.map(n => ({ url: n.url.replace(BASE, ''), diff: Math.round(n.t - navLog[0].t) + 'ms' }))));

    if (finalUrl.includes('/report')) {
      console.log('PASS: Login redirect works!\n');
    } else {
      console.log('FAIL: Login did not redirect to /report\n');
    }
  } else {
    console.log('UNEXPECTED: Not redirected to /login\n');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_v2_not_login.png', fullPage: true });
  }

  // === TEST 2: Ad unlock flow ===
  console.log('--- TEST 2: Ad unlock flow ---');

  // Check user reports
  const mineRes = await fetch(BASE + '/api/reports/mine', {
    headers: { Authorization: 'Bearer ' + token }
  }).then(r => r.json());
  console.log('User reports:', JSON.stringify(mineRes));

  if (mineRes.reports && mineRes.reports.length > 0) {
    const reportId = mineRes.reports[0].id;
    console.log('Using report:', reportId);

    // Create new context WITH token
    const browser2 = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context2 = await browser2.newContext();
    await context2.addInitScript((t) => {
      localStorage.setItem('session_token', t);
    }, token);
    const page2 = await context2.newPage();

    const tier2Reqs = [];
    page2.on('request', (req) => {
      if (req.url().includes('tier2/status') && req.method() === 'GET') {
        tier2Reqs.push({ t: Date.now(), url: req.url() });
      }
    });

    console.log('Navigating to /report?tab=进阶...');
    await page2.goto(BASE + '/report?id=' + reportId + '&tab=%E8%BF%9B%E9%98%B6', { waitUntil: 'networkidle', timeout: 20000 });
    await page2.waitForTimeout(3000);
    console.log('URL:', page2.url().replace(BASE, ''));
    await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_v2_start.png', fullPage: true });

    // Check tier2 status directly
    const t2Status = await page2.evaluate((token) => {
      return fetch('/api/tier2/status?tier1ReportId=' + encodeURIComponent('@reportId@'), {
        headers: { Authorization: 'Bearer ' + token }
      }).then(r => r.json());
    }, token.replace('@reportId@', reportId));
    console.log('Tier2 status:', JSON.stringify(t2Status));

    const hasUnlockBtn = await page2.locator('button:has-text("看广告解锁")').count();
    const hasContent = await page2.locator('.report-core-card').count();
    const hasProcessing = await page2.locator('.report-loading p:has-text("AI 正在生成进阶报告")').count();
    console.log('Unlock buttons:', hasUnlockBtn, '| Content:', hasContent, '| Processing:', hasProcessing);

    if (hasUnlockBtn > 0) {
      console.log('Clicking 看广告解锁...');
      await page2.locator('button:has-text("看广告解锁")').click();
      await page2.waitForTimeout(2000);

      const adVisible = await page2.locator('.tier2-ad-overlay').count();
      console.log('Ad overlay visible:', adVisible > 0);

      if (adVisible > 0) {
        console.log('Waiting for ad (6s)...');
        await page2.waitForTimeout(6000);

        const afterAdProcessing = await page2.locator('.report-loading p:has-text("AI 正在生成进阶报告")').count();
        const afterAdContent = await page2.locator('.report-core-card').count();
        console.log('After ad - Processing:', afterAdProcessing, '| Content:', afterAdContent);
        console.log('tier2/status requests:', tier2Reqs.length);

        if (afterAdProcessing > 0 && afterAdContent === 0) {
          console.log('Polling for completion (30s max)...');
          try {
            await page2.waitForSelector('.report-core-card', { timeout: 30000 });
            console.log('SUCCESS: Content appeared!');
            await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_v2_ready.png', fullPage: true });
          } catch {
            console.log('TIMEOUT: Stuck in processing');
            console.log('Total tier2/status requests:', tier2Reqs.length);
            if (tier2Reqs.length > 0) {
              const times = tier2Reqs.map(r => Math.round(r.t - tier2Reqs[0].t));
              console.log('Request intervals (ms):', times.join(', '));
            }
            await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_v2_stuck.png', fullPage: true });
          }
        } else if (afterAdContent > 0) {
          console.log('Content visible after ad!');
          await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_v2_ready.png', fullPage: true });
        } else {
          console.log('Unexpected state after ad');
          const state = await page2.evaluate(() => ({
            processing: document.querySelector('.report-loading p')?.textContent || 'none',
            hasCoreCard: document.querySelector('.report-core-card') !== null
          }));
          console.log('State:', JSON.stringify(state));
          await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_v2_after_ad.png', fullPage: true });
        }
      } else {
        console.log('No ad overlay appeared');
        const state = await page2.evaluate(() => ({
          processing: document.querySelector('.report-loading p')?.textContent || 'none',
          hasCoreCard: document.querySelector('.report-core-card') !== null,
          hasOverlay: document.querySelector('.tier2-ad-overlay') !== null
        }));
        console.log('State:', JSON.stringify(state));
        await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_v2_no_ad.png', fullPage: true });
      }
    } else if (hasContent > 0) {
      console.log('Content already visible - tier2 already generated');
      await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_v2_already.png', fullPage: true });
    } else {
      console.log('No unlock button, no content - checking buttons');
      const btnTexts = await page2.locator('button').allTextContents();
      console.log('All buttons:', btnTexts.filter(t => t.trim()));
      await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_v2_no_btn.png', fullPage: true });
    }

    await browser2.close();
  } else {
    console.log('No reports for this user - cannot test ad unlock');
  }

  await browser.close();
  console.log('\n=== Tests Complete ===');
})();
