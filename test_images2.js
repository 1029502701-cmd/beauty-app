const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set the session token directly in localStorage
  await page.goto('http://127.0.0.1:8788');
  await page.evaluate(() => {
    localStorage.setItem('session_token', '58a91a89-76c1-4474-85ce-98fb9c194802');
  });
  
  // Navigate to the report page
  await page.goto('http://127.0.0.1:8788/report/tier2-e2e-001');
  await page.waitForTimeout(5000);
  
  // Check images using the exact code from the task
  const images = await page.$$eval('img', imgs =>
    imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
  );
  console.log(JSON.stringify(images, null, 2));
  
  await browser.close();
})();
