const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://127.0.0.1:8788";
const OUT = "C:\\\\Users\\\\yao\\\\Documents\\\\ChatGPT\\\\\\u7f8e\\u5986app\\\\test_output";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();

  await pg.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(2000);

  // Screenshot the login page
  await pg.screenshot({ path: OUT + "\\\\login_page.png", fullPage: true });
  console.log("Screenshot saved: login_page.png");

  // Get page HTML structure
  const html = await pg.evaluate(() => document.body.innerHTML.substring(0, 3000));
  console.log("Page HTML:", html);

  // Get all inputs
  const inputs = await pg.evaluate(() => {
    return Array.from(document.querySelectorAll("input")).map((i, idx) => ({
      idx,
      type: i.type,
      name: i.name,
      placeholder: i.placeholder,
      id: i.id,
      className: i.className
    }));
  });
  console.log("Inputs:", JSON.stringify(inputs, null, 2));

  // Get all buttons
  const buttons = await pg.evaluate(() => {
    return Array.from(document.querySelectorAll("button")).map((b, idx) => ({
      idx,
      text: b.textContent.trim().substring(0, 50),
      className: b.className
    }));
  });
  console.log("Buttons:", JSON.stringify(buttons, null, 2));

  await browser.close();
})().catch(e => { console.error("Failed:", e.message); process.exit(1); });
