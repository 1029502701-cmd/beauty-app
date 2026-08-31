const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://127.0.0.1:8788');
  await page.evaluate(() => {
    localStorage.setItem('session_token', '58a91a89-76c1-4474-85ce-98fb9c194802');
  });
  
  await page.goto('http://127.0.0.1:8788/report/t1-e2e-extreme');
  await page.waitForTimeout(8000);
  
  const images = await page.$$eval('img', imgs =>
    imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
  );
  console.log(JSON.stringify(images, null, 2));
  
  const text = await page.textContent('body');
  const hasCPB = text.includes('CPB');
  const hasLancome = text.includes('兰蔻') || text.includes('小黑瓶');
  console.log('Extreme - Has CPB curated:', hasCPB);
  console.log('Extreme - Has Lancome curated:', hasLancome);
  
  await browser.close();
})();
