const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true});
  const c = await b.newContext();
  const p = await c.newPage();
  
  await p.goto("https://e9fcd454.beauty-api-pages.pages.dev/login", {waitUntil:"domcontentloaded"});
  await p.waitForTimeout(800);
  await p.locator('input[placeholder*="手机号"]').first().fill("13900000099");
  const pw = await p.locator('input[type="password"]').all();
  await pw[0].fill("Test1234");
  await pw[1].fill("Test1234");
  await p.locator("button.login-btn").click();
  await p.waitForURL("**/home*", {timeout:10000});
  await p.waitForTimeout(500);
  
  const fetchCalls = [];
  await p.route("**/api/**", async route => {
    const req = route.request();
    fetchCalls.push({ method: req.method(), path: req.url().replace("https://e9fcd454.beauty-api-pages.pages.dev","") });
    await route.continue();
  });
  
  await p.goto("https://e9fcd454.beauty-api-pages.pages.dev/tier2-result?reportId=2dec662c-fe6e-4ec4-b9a6-7b41e59bf413", {waitUntil:"networkidle", timeout:20000});
  await p.waitForTimeout(3000);
  
  const info = await p.evaluate(() => ({
    pathname: window.location.pathname,
    bodyText: document.body.innerText.substring(0, 500),
    classes: Array.from(document.querySelectorAll("*")).slice(0, 30).map(el => el.className).filter(Boolean),
    token: localStorage.getItem("session_token") ? localStorage.getItem("session_token").slice(0,12) : "none",
    html: document.body.innerHTML.substring(0, 1000)
  }));
  console.log(JSON.stringify(info, null, 2));
  console.log("Fetch calls:", JSON.stringify(fetchCalls, null, 2));
  await b.close();
})();
