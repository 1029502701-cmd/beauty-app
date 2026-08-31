const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("console", msg => console.log("[" + msg.type() + "]", msg.text().substring(0, 200)));
  page.on("pageerror", err => console.error("PAGE ERR:", err.message));
  
  await page.goto("http://127.0.0.1:8788/", { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.evaluate(() => localStorage.setItem("session_token", "0eb84a72-c33a-4491-b3d6-e384d079506b"));
  await page.goto("http://127.0.0.1:8788/report/c25437d5-526a-4af7-baec-33694aa76825", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const allText = await page.evaluate(() => document.body?.innerText || "");
  console.log("Body text len:", allText.length, "first 300:", allText.substring(0, 300));
  
  const rootHTML = await page.evaluate(() => document.getElementById("root")?.innerHTML?.substring(0, 500) || "NO ROOT");
  console.log("Root HTML:", rootHTML);
  
  await page.screenshot({ path: "C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\tier2-report-screenshot.png", fullPage: true });
  console.log("Screenshot saved");
  await browser.close();
})();
