const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://127.0.0.1:8788";
const OUT = "C:\\\\Users\\\\yao\\\\Documents\\\\ChatGPT\\\\\\u7f8e\\u5986app\\\\test_output";

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();

  await pg.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(2000);

  // Get all elements with text
  const allText = await pg.evaluate(() => {
    const els = Array.from(document.querySelectorAll("button, div, span, p, label"));
    return els.filter(el => {
      const t = el.textContent?.trim();
      return t && t.length > 0 && t.length < 30 && !el.classList.contains("input-field");
    }).map(el => ({
      tag: el.tagName,
      text: el.textContent.trim(),
      class: el.className.substring(0, 60),
      visible: el.offsetParent !== null
    }));
  });
  console.log("Page elements:", JSON.stringify(allText, null, 2));

  // Try clicking on SMS tab
  const smsBtn = await pg.locator('button:has-text("验证码"), button:has-text("SMS"), button:has-text("短信"), button:has-text("Code")').count();
  console.log("SMS buttons:", smsBtn);

  // Check for tab switcher
  const tabs = await pg.locator('[class*="tab"], [class*="Tab"]').count();
  console.log("Tab elements:", tabs);

  await browser.close();
})().catch(e => { console.error("Failed:", e.message); process.exit(1); });
