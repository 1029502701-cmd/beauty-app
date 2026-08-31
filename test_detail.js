const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://127.0.0.1:8788');
  await page.evaluate(() => {
    localStorage.setItem('session_token', '58a91a89-76c1-4474-85ce-98fb9c194802');
  });
  
  await page.goto('http://127.0.0.1:8788/report/t1-e2e-001');
  await page.waitForTimeout(10000);
  
  // Check images
  const images = await page.$$eval('img', imgs =>
    imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
  );
  console.log('IMAGES:', JSON.stringify(images, null, 2));
  
  // Check text content
  const body = await page.$eval('body', el => el.innerText);
  console.log('BODY TEXT (first 2000):', body.substring(0, 2000));
  
  // Check for product-related DOM elements
  const products = await page.$$eval('.report-product, [class*="product"], [class*="rec"]', els =>
    els.map(el => ({ tag: el.tagName, class: el.className, text: el.innerText?.substring(0, 100) }))
  );
  console.log('PRODUCTS:', JSON.stringify(products, null, 2));
  
  await browser.close();
})();
