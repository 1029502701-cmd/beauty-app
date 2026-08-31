const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("http://127.0.0.1:8788");
  await page.evaluate(() => {
    localStorage.setItem("session_token", "58a91a89-76c1-4474-85ce-98fb9c194802");
  });

  // Normal report
  await page.goto("http://127.0.0.1:8788/report/t1-e2e-001");
  // Wait for tier2 to load and render
  await page.waitForFunction(() => {
    const el = document.querySelector("[class*='product'], [class*='rec'], [class*='item']");
    return el && el.textContent.length > 10;
  }, undefined, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);

  const images1 = await page.$$eval("img", imgs =>
    imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
  );

  // Extreme report
  await page.goto("http://127.0.0.1:8788/report/t1-e2e-extreme");
  await page.waitForFunction(() => {
    const el = document.querySelector("[class*='product'], [class*='rec'], [class*='item']");
    return el && el.textContent.length > 10;
  }, undefined, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);

  const images2 = await page.$$eval("img", imgs =>
    imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
  );

  console.log("=== NORMAL REPORT ===");
  console.log(JSON.stringify(images1, null, 2));
  console.log("=== EXTREME REPORT ===");
  console.log(JSON.stringify(images2, null, 2));

  await browser.close();
})();
