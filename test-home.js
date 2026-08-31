const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://4a8fc1dd.beauty-api-pages.pages.dev/login", { waitUntil: "networkidle" });
  await page.fill('input[placeholder*="手机"]', "jack_test_home@example.com");
  await page.fill('input[placeholder*="密码"]:not([placeholder*="再次"])', "Test1234");
  await page.fill('input[placeholder*="再次"]', "Test1234");
  await page.click("button.login-btn");
  await page.waitForTimeout(2000);
  var body = await page.evaluate(() => document.body.innerText.substring(0, 300));
  console.log("NEW_DEPLOY_BODY: " + body);
  console.log("NEW_DEPLOY_URL: " + page.url());
  await browser.close();
  console.log("DONE");
})().catch(function(e) { console.error("FATAL: " + e.message); });
