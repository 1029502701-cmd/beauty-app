const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Register new account via API
  const regRes = await fetch('http://localhost:8788/api/auth/login-or-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '13700000001', password: 'TestPass1', confirmPassword: 'TestPass1' })
  }).then(r => r.json());
  console.log('=== Register ===');
  console.log('Register:', JSON.stringify(regRes));
  const token = regRes.sessionId;
  console.log('Token:', token);

  // ===== TEST 1: Login redirect bug =====
  console.log('\n=== TEST 1: Login redirect from protected route ===');

  await page.addInitScript(() => {
    localStorage.removeItem('session_token');
    sessionStorage.clear();
  });

  const navLog = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navLog.push({ t: Date.now(), url: frame.url() });
  });

  const reportUrl = 'http://localhost:8788/report?id=44ef8170-9176-40f2-ba2b-7aabb6802ada';
  console.log('Navigating to protected route:', reportUrl);
  await page.goto(reportUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('URL after goto:', page.url());
  const isOnLogin = page.url().includes('/login');
  console.log('Is on /login?', isOnLogin);

  if (isOnLogin) {
    const redirectFrom = await page.evaluate(() => sessionStorage.getItem('auth_redirect_from'));
    console.log('auth_redirect_from:', redirectFrom);

    // Fill login form
    await page.fill('input[placeholder*="手机号 / 邮箱"]', '13700000001');
    await page.fill('input[placeholder*="请输入密码"]', 'TestPass1');
    await page.fill('input[placeholder*="请再次输入密码"]', 'TestPass1');

    console.log('Clicking login button...');
    await page.locator('button:has-text("登录 / 注册")').click();

    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    console.log('Nav log:', JSON.stringify(navLog.map(n => ({ url: n.url, diff: Math.round(n.t - navLog[0].t) + 'ms' }))));

    if (finalUrl.includes('report')) {
      console.log('PASS: Redirect to protected route works!');
    } else {
      console.log('BUG CONFIRMED: Login did NOT redirect to /report, went to:', finalUrl);
    }
  } else {
    console.log('Unexpected: not redirected to /login');
  }

  // ===== TEST 2: Ad unlock stuck bug =====
  console.log('\n=== TEST 2: Ad unlock flow ===');

  // Set token for authenticated session
  await page.addInitScript((t) => {
    localStorage.setItem('session_token', t);
    sessionStorage.clear();
  }, token);

  const navLog2 = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navLog2.push({ t: Date.now(), url: frame.url() });
  });

  // Track network requests
  const tier2StatusRequests = [];
  page.on('request', (req) => {
    if (req.url().includes('tier2/status') && req.method() === 'GET') {
      tier2StatusRequests.push({ t: Date.now(), url: req.url() });
    }
  });

  console.log('Navigating to /report?tab=进阶...');
  await page.goto('http://localhost:8788/report?id=44ef8170-9176-40f2-ba2b-7aabb6802ada&tab=%E8%BF%9B%E9%98%B6', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  console.log('URL:', page.url());
  await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test2_start.png', fullPage: true });

  const hasUnlockBtn = await page.locator('button:has-text("看广告解锁")').count();
  const hasProcessing = await page.locator('.report-loading p').count();
  const hasContent = await page.locator('.report-core-card').count();
  console.log('Unlock buttons:', hasUnlockBtn, '| Processing:', hasProcessing, '| Content:', hasContent);

  if (hasUnlockBtn > 0) {
    console.log('Clicking 看广告解锁...');
    await page.locator('button:has-text("看广告解锁")').click();

    await page.waitForTimeout(2000);
    const adVisible = await page.locator('.tier2-ad-overlay').count();
    console.log('Ad overlay visible:', adVisible > 0);

    // Wait for ad (5s duration)
    console.log('Waiting for ad to complete (6s)...');
    await page.waitForTimeout(6000);

    const afterAdUrl = page.url();
    const afterAdProcessing = await page.locator('.report-loading p:has-text("AI 正在生成进阶报告")').count();
    const afterAdContent = await page.locator('.report-core-card').count();
    console.log('After ad - URL:', afterAdUrl);
    console.log('After ad - Processing:', afterAdProcessing, '| Content:', afterAdContent);
    console.log('Tier2 status requests so far:', tier2StatusRequests.length);

    if (afterAdProcessing > 0 && afterAdContent === 0) {
      console.log('Stuck in processing! Waiting for polling...');
      try {
        await page.waitForSelector('.report-core-card', { timeout: 30000 });
        console.log('SUCCESS: Content appeared within 30s!');
        await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test2_ready.png', fullPage: true });
      } catch {
        console.log('BUG CONFIRMED: Stuck in processing after 30s timeout');
        console.log('Total tier2/status requests:', tier2StatusRequests.length);
        console.log('Request timestamps (ms from start):', tier2StatusRequests.map(r => Math.round(r.t - tier2StatusRequests[0].t)));
        await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test2_stuck.png', fullPage: true });
      }
    } else if (afterAdContent > 0) {
      console.log('Content already visible after ad!');
      await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test2_ready.png', fullPage: true });
    } else {
      console.log('Unexpected state after ad');
      await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test2_after_ad.png', fullPage: true });
    }
  } else if (hasContent > 0) {
    console.log('Content already visible');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test2_already.png', fullPage: true });
  } else {
    console.log('No unlock button and no content - checking state');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test2_no_state.png', fullPage: true });
  }

  console.log('\n=== All tests complete ===');
  await browser.close();
})();
