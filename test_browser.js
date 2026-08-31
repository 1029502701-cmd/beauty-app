const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect all console logs
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));
  
  // Login
  await page.goto('http://127.0.0.1:8788/login');
  await page.waitForTimeout(1000);
  
  // Fill login form
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].fill('13900000066');
    await inputs[1].fill('TestPass1');
    await inputs[0].press('Enter');
    await page.waitForTimeout(2000);
  }
  
  // Check current URL and navigate to report
  const currentUrl = page.url();
  console.log('Current URL after login:', currentUrl);
  
  // Try navigating to tier2 report
  try {
    await page.goto('http://127.0.0.1:8788/report/tier2-e2e-001');
    await page.waitForTimeout(5000);
  } catch(e) {
    console.log('Report nav error:', e.message);
  }
  
  // Check images on page
  const images = await page.$$eval('img', imgs => 
    imgs.map(img => ({ 
      src: img.src.substring(0, 80), 
      loaded: img.complete && img.naturalWidth > 0,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    }))
  );
  console.log('=== IMAGES ===');
  console.log(JSON.stringify(images, null, 2));
  
  // Check for any product-related elements
  const products = await page.$$eval('[class*="product"], [class*="rec"], [class*="item"]', els =>
    els.map(el => ({
      text: el.textContent?.substring(0, 50),
      hasImg: !!el.querySelector('img')
    }))
  );
  console.log('=== PRODUCTS ===');
  console.log(JSON.stringify(products, null, 2));
  
  await browser.close();
  
  // Print console logs
  if (logs.length > 0) {
    console.log('=== CONSOLE LOGS ===');
    logs.slice(-20).forEach(l => console.log(l));
  }
})();
