const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on("console", msg => {
    if (msg.type() !== "debug") console.log(msg.type() + ": " + msg.text().substring(0, 300));
  });
  page.on("pageerror", err => console.log("PAGEERROR: " + err.message));
  
  await page.addInitScript(() => localStorage.setItem("session_token", "8f4873ff-746d-4170-9308-90b106aea95a"));
  
  console.log("=== Navigating ===");
  await page.goto("http://localhost:5174/report?id=44ef8170-9176-40f2-ba2b-7aabb6802ada", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // Click 进阶 tab
  console.log("=== Clicking 进阶 tab ===");
  const tabs = await page.$$(".report-tab");
  console.log("Found", tabs.length, "tabs");
  for (let i = 0; i < tabs.length; i++) {
    const text = await tabs[i].textContent();
    console.log("Tab", i, ":", text.trim());
    if (text.trim() === "进阶") await tabs[i].click();
  }
  await page.waitForTimeout(3000);
  
  const text = await page.textContent("body");
  console.log("\nAfter click body text (first 800):", text.substring(0, 800));
  
  const hasContent = text.includes("核心建议") || text.includes("风格定位");
  const hasUnlock = text.includes("分享解锁") || text.includes("看广告解锁");
  const hasProcessing = text.includes("AI 正在生成") || text.includes("请稍候");
  console.log("\nhasContent:", hasContent, "hasUnlock:", hasUnlock, "hasProcessing:", hasProcessing);
  
  await page.screenshot({ path: "test_output/e2e_debug6.png", fullPage: true });
  console.log("[SCREENSHOT] e2e_debug6.png");
  
  await browser.close();
})();
