const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const pg = await (await browser.newContext()).newPage();

  // Login
  await pg.goto("https://e9fcd454.beauty-api-pages.pages.dev/login", { waitUntil: "domcontentloaded" });
  await pg.waitForTimeout(1000);
  await pg.locator('input[placeholder*="手机号"]').first().fill("13900000099");
  const pwFields = await pg.locator('input[type="password"]').all();
  await pwFields[0].fill("Test1234");
  await pwFields[1].fill("Test1234");
  await pg.locator("button.login-btn").click();
  await pg.waitForURL("**/home*", { timeout: 10000 });
  await pg.waitForTimeout(1000);

  // Navigate to tier2
  await pg.goto("https://e9fcd454.beauty-api-pages.pages.dev/tier2-result?reportId=2dec662c-fe6e-4ec4-b9a6-7b41e59bf413", { waitUntil: "domcontentloaded" });
  await pg.waitForTimeout(5000);

  // Check state
  const info = await pg.evaluate(() => ({
    url: window.location.href,
    bodyText: document.body.innerText.substring(0, 600),
    dimCards: document.querySelectorAll(".t2-dim-card").length,
    errorText: document.querySelector(".t2-error-text")?.textContent || "none",
    loadingState: document.querySelector(".t2-loading") ? "loading" : "not loading",
    token: localStorage.getItem("session_token")?.slice(0, 12) || "none",
    hasContent: !!document.querySelector(".t2-hero-content"),
    btnCount: document.querySelectorAll(".t2-btn").length
  }));
  console.log(JSON.stringify(info, null, 2));

  await pg.screenshot({ path: "C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test_output\\P_debug_prod.png" });
  console.log("Screenshot saved");
  await browser.close();
})();
