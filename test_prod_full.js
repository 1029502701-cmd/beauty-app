const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const BASE = 'https://b7e8dcb2.beauty-api-pages.pages.dev';

  console.log('=== Production Test (New Deploy) ===\n');

  // === TEST 1: Login redirect ===
  console.log('--- TEST 1: Login redirect ---');
  
  const regRes = await fetch(BASE + '/api/auth/login-or-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '13600000002', password: 'TestPass2', confirmPassword: 'TestPass2' })
  }).then(r => r.json());
  console.log('Register:', JSON.stringify(regRes));
  const token = regRes.sessionId;
  console.log('Token:', token);

  // Set up browser with token, then clear for unauthenticated test
  await page.addInitScript((t) => {
    localStorage.setItem('session_token', t);
    sessionStorage.clear();
  }, token);

  const navLog = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navLog.push({ t: Date.now(), url: frame.url() });
  });

  // Clear token to simulate unauthenticated
  await page.addInitScript(() => {
    localStorage.removeItem('session_token');
    sessionStorage.clear();
  });

  console.log('Navigating to /report (unauthenticated)...');
  await page.goto(BASE + '/report?id=44ef8170-9176-40f2-ba2b-7aabb6802ada', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('URL after goto:', page.url().replace(BASE, ''));

  if (page.url().includes('/login')) {
    const redirectFrom = await page.evaluate(() => sessionStorage.getItem('auth_redirect_from'));
    console.log('auth_redirect_from:', redirectFrom);

    await page.fill('input[placeholder*="手机号 / 邮箱"]', '13600000002');
    await page.fill('input[placeholder*="请输入密码"]', 'TestPass2');
    await page.fill('input[placeholder*="请再次输入密码"]', 'TestPass2');

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
    console.log('UNEXPECTED: Not on /login page\n');
  }

  // === TEST 2: Ad unlock flow ===
  console.log('--- TEST 2: Ad unlock flow ---');
  
  // Set up with valid token
  await page.addInitScript((t) => {
    localStorage.setItem('session_token', t);
    sessionStorage.clear();
  }, token);

  const tier2Status = await page.evaluate(async (token) => {
    const r = await fetch(BASE + '/api/tier2/status?tier1ReportId=44ef8170-9176-40f2-ba2b-7aabb6802ada', {
      headers: { Authorization: 'Bearer ' + token }
    });
    return await r.json();
  }, token);
  console.log('Tier2 Status:', JSON.stringify(tier2Status));

  // Check if report exists for this user
  const mineRes = await fetch(BASE + '/api/reports/mine', {
    headers: { Authorization: 'Bearer ' + token }
  }).then(r => r.json());
  console.log('User reports:', JSON.stringify(mineRes));

  if (mineRes.reports && mineRes.reports.length > 0) {
    const reportId = mineRes.reports[0].id;
    console.log('Using report:', reportId);

    const tier2Reqs = [];
    page.on('request', (req) => {
      if (req.url().includes('tier2/status') && req.method() === 'GET') {
        tier2Reqs.push({ t: Date.now(), url: req.url() });
      }
    });

    console.log('Navigating to /report?tab=进阶...');
    await page.goto(BASE + '/report?id=' + reportId + '&tab=%E8%BF%9B%E9%98%B6', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);
    console.log('URL:', page.url().replace(BASE, ''));
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_new_test_start.png', fullPage: true });

    const hasUnlockBtn = await page.locator('button:has-text("看广告解锁")').count();
    const hasContent = await page.locator('.report-core-card').count();
    const hasProcessing = await page.locator('.report-loading p:has-text("AI 正在生成进阶报告")').count();
    console.log('Unlock buttons:', hasUnlockBtn, '| Content:', hasContent, '| Processing:', hasProcessing);

    if (hasUnlockBtn > 0) {
      console.log('Clicking 看广告解锁...');
      await page.locator('button:has-text("看广告解锁")').click();
      await page.waitForTimeout(2000);

      const adVisible = await page.locator('.tier2-ad-overlay').count();
      console.log('Ad overlay visible:', adVisible > 0);

      if (adVisible > 0) {
        console.log('Waiting for ad (5s)...');
        await page.waitForTimeout(6000);

        const afterAdProcessing = await page.locator('.report-loading p:has-text("AI 正在生成进阶报告")').count();
        const afterAdContent = await page.locator('.report-core-card').count();
        console.log('After ad - Processing:', afterAdProcessing, '| Content:', afterAdContent);
        console.log('tier2/status requests:', tier2Reqs.length);

        if (afterAdProcessing > 0 && afterAdContent === 0) {
          console.log('Polling for completion (30s max)...');
          try {
            await page.waitForSelector('.report-core-card', { timeout: 30000 });
            console.log('SUCCESS: Content appeared!');
            await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_new_test_ready.png', fullPage: true });
          } catch {
            console.log('TIMEOUT: Stuck in processing');
            console.log('Total tier2/status requests:', tier2Reqs.length);
            if (tier2Reqs.length > 0) {
              const times = tier2Reqs.map(r => Math.round(r.t - tier2Reqs[0].t));
              console.log('Request intervals (ms):', times.join(', '));
            }
            await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_new_test_stuck.png', fullPage: true });
          }
        } else if (afterAdContent > 0) {
          console.log('Content already visible!');
          await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_new_test_ready.png', fullPage: true });
        }
      } else {
        console.log('No ad overlay - checking state');
        const state = await page.evaluate(() => ({
          processing: document.querySelector('.report-loading p')?.textContent || 'none',
          hasCoreCard: document.querySelector('.report-core-card') !== null
        }));
        console.log('State:', JSON.stringify(state));
      }
    } else if (hasContent > 0) {
      console.log('Content already visible');
      await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_new_test_already.png', fullPage: true });
    } else {
      console.log('No unlock button and no content - checking page state');
      const btnTexts = await page.locator('button').allTextContents();
      console.log('Buttons:', btnTexts.filter(t => t.trim()).slice(0, 10));
      await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_new_test_no_btn.png', fullPage: true });
    }
  } else {
    console.log('No reports for this user - cannot test ad unlock flow');
    console.log('This account needs a tier1 report first. Skipping ad unlock test.\n');
  }

  await browser.close();
  console.log('=== Tests Complete ===');
})();
