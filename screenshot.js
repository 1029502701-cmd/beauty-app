const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("console", msg => console.log("PAGE LOG:", msg.text().substring(0, 100)));
  page.on("pageerror", err => console.error("PAGE ERROR:", err.message));
  await page.goto("http://127.0.0.1:8788/report/c25437d5-526a-4af7-baec-33694aa76825", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\tier2-report-screenshot.png", fullPage: true });
  console.log("Screenshot saved");
  const imgStatus = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img[src*="alicdn"]');
    return Array.from(imgs).map(img => ({ src: img.src.substring(0, 80), w: img.naturalWidth, h: img.naturalHeight }));
  });
  console.log("Images found: " + imgStatus.length);
  imgStatus.forEach((img, i) => console.log("  " + i + ": " + img.src + " (" + img.w + "x" + img.h + ")"));
  await browser.close();
})();
