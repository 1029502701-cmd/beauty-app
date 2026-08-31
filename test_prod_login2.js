const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const BASE = 'https://69ca2181.beauty-api-pages.pages.dev';

  console.log('=== Production Test: Login redirect ===');

  // Register on production via Node.js fetch
  const regRes = await fetch(BASE + '/api/auth/login-or-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '13600000001', password: 'TestPass1', confirmPassword: 'TestPass1' })
  }).then(r => r.json());
  console.log('Register:', JSON.stringify(regRes));
  const token = regRes.sessionId;
  console.log('Token:', token);

  // Set browser cookie/localStorage with token
  await page.addInitScript((t) => {
    localStorage.setItem('session_token', t);
    sessionStorage.clear();
  }, token);

  // Test login redirect: navigate to protected route WITHOUT token first
  console.log('\n--- Step A: Unauthenticated navigation ---');
  await page.addInitScript(() => {
    localStorage.removeItem('session_token');
    sessionStorage.clear();
  });

  const navLog = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navLog.push({ t: Date.now(), url: frame.url() });
  });

  const reportUrl = BASE + '/report?id=44ef8170-9176-40f2-ba2b-7aabb6802ada';
  console.log('Navigating to:', reportUrl);
  await page.goto(reportUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log('URL after goto:', page.url());
  console.log('Nav log:', JSON.stringify(navLog.map(n => ({ url: n.url.replace(BASE, ''), diff: Math.round(n.t - navLog[0].t) + 'ms' }))));

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
    await page.waitForTimeout(4000);

    const finalUrl = page.url();
    console.log('Final URL:', finalUrl.replace(BASE, ''));
    console.log('Full nav log:', JSON.stringify(navLog.map(n => ({ url: n.url.replace(BASE, ''), diff: Math.round(n.t - navLog[0].t) + 'ms' }))));

    if (finalUrl.includes('/report')) {
      console.log('PASS: Redirect to /report works on production!');
    } else {
      console.log('BUG CONFIRMED: Did not redirect to /report, went to:', finalUrl.replace(BASE, ''));
    }
  } else {
    console.log('Unexpected: not redirected to /login');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_login_test.png', fullPage: true });
  }

  await browser.close();
  console.log('\n=== Test Complete ===');
})();
