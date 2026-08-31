const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to the app
  await page.goto('http://127.0.0.1:8788/login');
  
  // Login with test credentials
  await page.fill('input[placeholder*="手机"]', '13900000066');
  await page.fill('input[placeholder*="密码"]', 'TestPass1');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  
  // Navigate to a report page with tier2 data
  await page.goto('http://127.0.0.1:8788/report/tier2-e2e-001');
  await page.waitForTimeout(3000);
  
  // Check images
  const images = await page.$$eval('img', imgs => 
    imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
  );
  console.log(JSON.stringify(images, null, 2));
  
  await browser.close();
})();
