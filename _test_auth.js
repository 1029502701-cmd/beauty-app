const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture all console logs
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  
  // Test 1: Unauthenticated access
  console.log('=== Test 1: Unauthenticated /tier1-result ===');
  const nav1 = await page.goto('http://localhost:5174/tier1-result', { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(3000);
  console.log('URL after nav:', page.url());
  console.log('Last 5 logs:', logs.slice(-5).join('\n'));
  
  // Test 2: With token
  console.log('\n=== Test 2: With token callback ===');
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidGVzdC11c2VyIiwiaWF0IjoxNzg4MTkxMDAzLCJleHAiOjE3ODgxOTQ2MDN9.7PP32czs2tLkG9zH0XYcnI7EA5YKvrX2Ed_rZC8fWXY=';
  const encodedRedirect = encodeURIComponent('http://localhost:5174/tier1-result');
  const logs2 = [];
  page.removeAllListeners('console');
  page.on('console', msg => logs2.push(msg.text()));
  const nav2 = await page.goto(`http://localhost:5174/?token=${token}&redirect=${encodedRedirect}`, { waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(3000);
  console.log('URL after token:', page.url());
  const lsToken = await page.evaluate(() => localStorage.getItem('session_token'));
  console.log('localStorage token:', lsToken ? 'YES (' + lsToken.slice(0,30) + '...)' : 'NO');
  console.log('Last 5 logs:', logs2.slice(-5).join('\n'));
  
  await browser.close();
})();
