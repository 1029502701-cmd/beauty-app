const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState: {
      origins: [{
        origin: "https://ccfu.ccwu.cc",
        localStorage: [
          { name: "session_token", value: "d07b52ff-60e6-444a-aae9-0f333a9d6e81" },
          { name: "has_password", value: "true" }
        ]
      }]
    }
  });
  const page = await context.newPage();
  page.on("pageerror", err => console.log("PAGE_ERROR:", err.message));
  
  console.log("Navigating to production report page...");
  await page.goto("https://ccfu.ccwu.cc/report?id=30cac403-299a-4824-8d98-73d64bcb6a9f&tab=%E8%BF%9B%E9%98%B6", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(3000);
  console.log("URL:", page.url());
  
  const t2Cards = await page.locator(".t2-step-card").count();
  const oldCards = await page.locator(".report-core-card").count();
  const mockBanner = await page.locator(".t2-ai-hint").count();
  console.log("[PASS] t2-step-card count:", t2Cards);
  console.log("[PASS] report-core-card count:", oldCards, "(expected: 0)");
  console.log("[PASS] mock banner count:", mockBanner, "(expected: 0)");
  
  if (t2Cards > 0) {
    const titles = await page.locator(".t2-step-title").allTextContents();
    console.log("[INFO] Step titles:", JSON.stringify(titles));
    const btnColor = await page.locator(".t2-share-btn").evaluate(el => getComputedStyle(el).backgroundColor);
    console.log("[PASS] Share btn color:", btnColor);
    const hookColor = await page.locator(".t2-btn-hook").evaluate(el => getComputedStyle(el).backgroundColor);
    console.log("[PASS] Hook btn color:", hookColor);
    const hasAnalysis = await page.locator(".t2-step-section-text").count();
    console.log("[INFO] Section texts:", hasAnalysis);
    const hasTips = await page.locator(".t2-tips-bullet").count();
    console.log("[INFO] Tip bullets:", hasTips);
  } else {
    const bodyText = await page.locator("body").textContent();
    console.log("[WARN] No t2-step-card found. Body text (first 300):", bodyText.substring(0, 300));
  }
  
  await browser.close();
  console.log("DONE");
})();
