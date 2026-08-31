const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  const logs = [];
  page.on('console', msg => {
    if (!msg.text().includes('vite')) logs.push(msg.text());
  });
  
  console.log('=== Test 1: /tier1-result no token (should redirect to auth) ===');
  await page.goto('http://localhost:5175/tier1-result', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  console.log('Redirects to auth:', page.url().includes('auth.meijian.top'));
  console.log('Errors:', errors);
  console.log('App logs:', logs);
  
  console.log('\n=== Test 2: /?token=xxx (should store token, navigate) ===');
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdC11c2VyIiwiaWF0IjoxNzg4MTkxMDAzLCJleHAiOjE3ODgxOTQ2MDN9.7PP32czs2tLkG9zH0XYcnI7EA5YKvrX2Ed_rZC8fWXY=';
  const enc = encodeURIComponent('http://localhost:5175/tier1-result');
  await page.goto(`http://localhost:5175/?token=${token}&redirect=${enc}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  console.log('Token removed from URL:', !page.url().includes('token='));
  const lsToken = await page.evaluate(() => localStorage.getItem('session_token'));
  console.log('Token stored:', lsToken ? 'YES (' + lsToken.slice(0,40) + '...)' : 'NO');
  console.log('Token matches:', lsToken === token);
  console.log('Errors:', errors);
  console.log('App logs:', logs);
  
  await browser.close();
})();
