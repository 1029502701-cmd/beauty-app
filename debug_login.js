const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('/api/') || req.url().includes('auth.meijian')) {
      requests.push({ type: 'request', url: req.url(), method: req.method() });
    }
  });
  page.on('response', resp => {
    if (resp.url().includes('/api/') || resp.url().includes('auth.meijian')) {
      requests.push({ type: 'response', url: resp.url(), status: resp.status() });
    }
  });
  
  // 清除 localStorage 模拟无痕模式
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  
  console.log('=== Navigating to ccfu.ccwu.cc ===');
  await page.goto('https://ccfu.ccwu.cc', { waitUntil: 'networkidle' });
  
  console.log('Current URL:', page.url());
  console.log('LocalStorage:', await page.evaluate(() => JSON.stringify(localStorage)));
  console.log('SessionStorage:', await page.evaluate(() => JSON.stringify(sessionStorage)));
  console.log('Console logs:', await page.evaluate(() => window.__diagnosticLogs || 'none'));
  
  // 模拟被 redirect 到 auth.meijian.top
  console.log('\n=== Simulating auth redirect ===');
  const authUrl = 'https://auth.meijian.top?redirect=' + encodeURIComponent('https://ccfu.ccwu.cc/');
  console.log('Would redirect to:', authUrl);
  
  // 模拟 callback（直接导航到带 token 的 URL）
  console.log('\n=== Simulating token callback ===');
  const token = 'test-diagnostic-token-12345';
  const callbackUrl = 'https://ccfu.ccwu.cc/?token=' + token;
  console.log('Navigating to:', callbackUrl);
  
  await page.goto(callbackUrl, { waitUntil: 'networkidle' });
  
  console.log('Current URL after callback:', page.url());
  console.log('LocalStorage after callback:', await page.evaluate(() => JSON.stringify(localStorage)));
  console.log('SessionStorage after callback:', await page.evaluate(() => JSON.stringify(sessionStorage)));
  console.log('Console logs after callback:', await page.evaluate(() => window.__diagnosticLogs || 'none'));
  
  // 等待几秒看是否有额外请求
  await page.waitForTimeout(3000);
  
  console.log('\n=== Final state ===');
  console.log('Current URL:', page.url());
  console.log('LocalStorage:', await page.evaluate(() => JSON.stringify(localStorage)));
  console.log('All requests:', JSON.stringify(requests, null, 2));
  
  await browser.close();
})();
