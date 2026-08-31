const { chromium } = require("playwright");
const timeout = 30000;

(async () => {
  const browser = await chromium.launch({ headless: true, timeout: timeout });
  const page = await browser.newPage();
  
  const results = [];
  
  try {
    await page.goto("http://127.0.0.1:8788", { timeout: 10000 });
    await page.evaluate(() => localStorage.setItem("session_token", "58a91a89-76c1-4474-85ce-98fb9c194802"));
    
    // Normal report
    await page.goto("http://127.0.0.1:8788/report/t1-e2e-001", { timeout: 15000 });
    await new Promise(r => setTimeout(r, 10000));
    
    const images1 = await page.$$eval("img", imgs =>
      imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
    );
    results.push({ report: "normal", images: images1 });
    
    // Extreme report
    await page.goto("http://127.0.0.1:8788/report/t1-e2e-extreme", { timeout: 15000 });
    await new Promise(r => setTimeout(r, 10000));
    
    const images2 = await page.$$eval("img", imgs =>
      imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
    );
    results.push({ report: "extreme", images: images2 });
  } catch(e) {
    results.push({ error: e.message });
  }
  
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
