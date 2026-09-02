const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs = [];
  page.on('console', msg => {
    if (msg.text().includes('[DIAG]')) {
      logs.push(msg.text());
      console.log('CONSOLE:', msg.text());
    }
  });
  
  // Clear storage
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  console.log('=== Step 1: Navigate to app ===');
  await page.goto('https://ccfu.ccwu.cc', { waitUntil: 'networkidle' });
  console.log('URL after load:', page.url());
  console.log('localStorage:', await page.evaluate(() => JSON.stringify(localStorage)));
  
  // Wait a bit for any redirects
  await page.waitForTimeout(2000);
  console.log('URL after wait:', page.url());
  
  await browser.close();
  
  if (logs.length === 0) {
    console.log('NO DIAG LOGS CAPTURED');
  }
})();
