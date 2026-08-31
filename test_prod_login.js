const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  console.log('=== Production Test: Login redirect ===');

  // Register new account on production
  const regRes = await page.evaluate(async () => {
    const r = await fetch('https://69ca2181.beauty-api-pages.pages.dev/api/auth/login-or-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13600000001', password: 'TestPass1', confirmPassword: 'TestPass1' })
    });
    return await r.json();
  });
  console.log('Register:', JSON.stringify(regRes));
  const token = regRes.sessionId;
  console.log('Token:', token);

  // Set up browser with token
  await page.addInitScript((t) => {
    localStorage.setItem('session_token', t);
    sessionStorage.clear();
  }, token);

  // Check tier2 status on production
  const tier2Status = await page.evaluate(async (token) => {
    const r = await fetch('https://69ca2181.beauty-api-pages.pages.dev/api/tier2/status?tier1ReportId=44ef8170-9176-40f2-ba2b-7aabb6802ada', {
      headers: { Authorization: 'Bearer ' + token }
    });
    return await r.json();
  }, token);
  console.log('Tier2 Status:', JSON.stringify(tier2Status));

  // Test login redirect on production
  console.log('\n=== Test: Login redirect on production ===');

  // Clear token to simulate unauthenticated state
  await page.addInitScript(() => {
    localStorage.removeItem('session_token');
    sessionStorage.clear();
  });

  const navLog = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navLog.push({ t: Date.now(), url: frame.url() });
  });

  const reportUrl = 'https://69ca2181.beauty-api-pages.pages.dev/report?id=44ef8170-9176-40f2-ba2b-7aabb6802ada';
  console.log('Navigating to:', reportUrl);
  await page.goto(reportUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('URL after goto:', page.url());
  const isOnLogin = page.url().includes('/login');
  console.log('Is on /login?', isOnLogin);

  if (isOnLogin) {
    const redirectFrom = await page.evaluate(() => sessionStorage.getItem('auth_redirect_from'));
    console.log('auth_redirect_from:', redirectFrom);

    await page.fill('input[placeholder*="手机号 / 邮箱"]', '13600000001');
    await page.fill('input[placeholder*="请输入密码"]', 'TestPass1');
    await page.fill('input[placeholder*="请再次输入密码"]', 'TestPass1');

    console.log('Clicking login...');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    console.log('Final URL:', finalUrl);
    console.log('Nav log:', JSON.stringify(navLog.map(n => ({ url: n.url, diff: Math.round(n.t - navLog[0].t) + 'ms' }))));

    if (finalUrl.includes('report')) {
      console.log('PASS: Redirect to /report works!');
    } else {
      console.log('BUG: Did not redirect to /report, went to:', finalUrl);
    }
  } else {
    console.log('Unexpected: not on /login');
  }

  await browser.close();
})();
