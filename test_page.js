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
  
  // Get the full page HTML
  const html = await page.content();
  // Check for key elements
  const hasProductRecs = html.includes('productRecs') || html.includes('产品推荐') || html.includes('product');
  const hasTier2Content = html.includes('coreMakeup') || html.includes('妆容') || html.includes('recommend');
  const pageText = await page.textContent('body');
  
  console.log('Page has product references:', hasProductRecs);
  console.log('Page has tier2 content:', hasTier2Content);
  console.log('Page text length:', pageText.length);
  console.log('Page text preview:', pageText.substring(0, 500));
  
  await browser.close();
})();
