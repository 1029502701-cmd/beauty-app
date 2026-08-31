const { chromium } = require("playwright");
const path = require("path");

const TOKEN = "6e6ffc12-41c";
const TIER2_ID = "6d954995-fb15-4135-a4a3-e8d922d2cb95";
const HOST = "https://f2e219a5.beauty-api-pages.pages.dev";
const OUT = "C:/Users/yao/Documents/ChatGPT/美妆app/test_output";

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pg = await ctx.newPage();
  
  // Collect console errors
  pg.on("console", msg => {
    if (msg.type() === "error") console.log("  [CONSOLE ERROR] " + msg.text());
  });
  pg.on("pageerror", err => {
    console.log("  [PAGE ERROR] " + err.message);
  });
  
  await pg.addInitScript(({ t }) => { localStorage.setItem("n", t); }, { t: TOKEN });
  
  console.log("Navigating...");
  await pg.goto(HOST + "/tier2-result?reportId=" + TIER2_ID, { waitUntil: "domcontentloaded", timeout: 20000 });
  await pg.waitForTimeout(3000);
  
  // Check if JS loaded
  const jsLoaded = await pg.evaluate(() => {
    const scripts = document.querySelectorAll("script[src]");
    return Array.from(scripts).map(s => s.src).join(", ");
  });
  console.log("  Scripts: " + jsLoaded);
  
  const html = await pg.evaluate(() => document.documentElement.outerHTML.substring(0, 500));
  console.log("  HTML: " + html);
  
  // Try waiting for network idle
  await pg.goto(HOST + "/tier2-result?reportId=" + TIER2_ID, { waitUntil: "networkidle", timeout: 30000 });
  await pg.waitForTimeout(5000);
  
  const body = await pg.evaluate(() => document.body ? document.body.innerHTML.substring(0, 500) : "no body");
  console.log("  Body after networkidle: " + body);
  
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  Lightbulb buttons: " + bulbCount);
  
  await pg.screenshot({ path: path.join(OUT, "browser_f2e_debug.png"), fullPage: false });
  console.log("  Screenshot saved");
  
  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
