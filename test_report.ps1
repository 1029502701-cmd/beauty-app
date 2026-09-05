const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", err => errors.push(err.toString()));
  try {
    await page.goto("https://ccfu.ccwu.cc/report?id=c20dd012-2c68-4846-b224-98e9473de504", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(5000);
    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 500) : "");
    const url = page.url();
    console.log("URL:", url);
    console.log("Title:", title);
    console.log("Body text:", bodyText);
    console.log("Errors:", errors);
  } catch (e) {
    console.log("Exception:", e.message);
  }
  await browser.close();
})();
