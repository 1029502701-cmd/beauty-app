const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://127.0.0.1:8788";
const OUT = "C:\\\\Users\\\\yao\\\\Documents\\\\ChatGPT\\\\美妆app\\\\test_output";

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();

  // Navigate directly to tier2-result with reportId
  await pg.goto(BASE + "/tier2-result?reportId=tier2-e2e-001", { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(3000);

  // Check what's on the page
  const bodyText = await pg.evaluate(() => document.body.innerText);
  console.log("Body text:", bodyText.substring(0, 800));

  // Check localStorage
  const ls = await pg.evaluate(() => ({
    session_token: localStorage.getItem("session_token"),
    admin_session_token: localStorage.getItem("admin_session_token")
  }));
  console.log("localStorage:", ls);

  // Check network requests
  const requests = await pg.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    return entries.filter(e => e.name.includes("/api/")).map(e => ({
      name: e.name,
      duration: Math.round(e.duration),
      transferSize: e.transferSize
    }));
  });
  console.log("API requests:", JSON.stringify(requests, null, 2));

  await pg.screenshot({ path: OUT + "\\\\tier2_direct.png", fullPage: true });
  console.log("Screenshot saved");

  await browser.close();
})().catch(e => { console.error("Failed:", e.message); process.exit(1); });
