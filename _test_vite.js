const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:5174/tier1-result', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  console.log('Errors:', errors);
  console.log('Body text:', (await page.textContent('body') || '').trim().slice(0, 100));
  await browser.close();
})();
