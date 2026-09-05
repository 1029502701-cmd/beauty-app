const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGE ERR:', err.message));
  await page.addInitScript(() => { localStorage.setItem('session_token','test-token-123'); });
  await page.route('**/api/reports/mine', r => r.fulfill({status:200,body:JSON.stringify([])}));
  await page.route('**/api/config/feature_request*', r => r.fulfill({status:404,body:'{}'}));
  await page.goto('https://9db21bfb.beauty-api-pages.pages.dev/home',{waitUntil:'networkidle'});
  await page.waitForTimeout(2000);
  console.log('HOME PAGE loaded');
  // Click AI美妆
  await page.click('button:has-text("AI 美妆")');
  await page.waitForTimeout(3000);
  console.log('AFTER CLICK URL:', page.url());
  console.log('AFTER CLICK CONTENT:', (await page.evaluate(()=>document.body.innerText.substring(0,400))));
  await browser.close();
})();
