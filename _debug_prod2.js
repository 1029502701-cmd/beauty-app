const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const pg = await (await browser.newContext()).newPage();
  
  await pg.goto("https://e9fcd454.beauty-api-pages.pages.dev/login", { waitUntil: "domcontentloaded" });
  await pg.waitForTimeout(800);
  await pg.locator('input[placeholder*="手机号"]').first().fill("13900000099");
  const pw = await pg.locator('input[type="password"]').all();
  await pw[0].fill("Test1234");
  await pw[1].fill("Test1234");
  await pg.locator("button.login-btn").click();
  await pg.waitForURL("**/home*", { timeout: 10000 });
  await pg.waitForTimeout(500);

  const token = await pg.evaluate(() => localStorage.getItem("session_token"));
  console.log("Token:", token ? token.slice(0,12) : "none");

  await pg.goto("https://e9fcd454.beauty-api-pages.pages.dev/tier2-result?reportId=2dec662c-fe6e-4ec4-b9a6-7b41e59bf413", { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);

  const info = await pg.evaluate(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
    bodyText: document.body.innerText.substring(0, 400),
    dimCards: document.querySelectorAll(".t2-dim-card").length,
    reportPage: document.querySelector(".report-title") ? "ReportPage" : "not ReportPage",
    tier2Page: document.querySelector(".t2-page") ? "Tier2Result" : "not Tier2Result",
    errorText: document.querySelector(".t2-error-text")?.textContent || document.querySelector(".report-invalid-desc")?.textContent || "none",
    loadingText: document.querySelector(".t2-loading")?.innerText || document.querySelector(".report-loading")?.innerText || "none",
    token: localStorage.getItem("session_token") ? localStorage.getItem("session_token").slice(0,12) : "none",
    t2Html: document.querySelector(".t2-page")?.innerHTML?.substring(0, 300) || "no t2-page"
  }));
  console.log(JSON.stringify(info, null, 2));
  await pg.screenshot({ path: "C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test_output\\P_debug_prod2.png" });
  await browser.close();
})();
