const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  
  console.log('=== Test 1: /tier1-result no token ===');
  await page.goto('http://localhost:5174/tier1-result', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  console.log('Page content (body text):', await page.textContent('body').catch(() => 'N/A').then(t => t.slice(0, 200)));
  console.log('Errors:', errors);
  console.log('Logs:', logs.filter(l => !l.includes('vite')));
  
  console.log('\n=== Test 2: /?token=xxx ===');
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdC11c2VyIiwiaWF0IjoxNzg4MTkxMDAzLCJleHAiOjE3ODgxOTQ2MDN9.7PP32czs2tLkG9zH0XYcnI7EA5YKvrX2Ed_rZC8fWXY=';
  const enc = encodeURIComponent('http://localhost:5174/tier1-result');
  await page.goto(`http://localhost:5174/?token=${token}&redirect=${enc}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  console.log('Page content:', await page.textContent('body').catch(() => 'N/A').then(t => t.slice(0, 200)));
  console.log('localStorage token:', await page.evaluate(() => localStorage.getItem('session_token')));
  console.log('Errors:', errors);
  console.log('Logs:', logs.filter(l => !l.includes('vite')));
  
  await browser.close();
})();
