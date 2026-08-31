const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true});
  const c = await b.newContext();
  const p = await c.newPage();
  
  const logs = [];
  p.on("console", msg => {
    logs.push(msg.type() + ": " + msg.text().substring(0, 200));
  });
  
  await p.goto("https://e9fcd454.beauty-api-pages.pages.dev/login", {waitUntil:"domcontentloaded"});
  await p.waitForTimeout(800);
  await p.locator('input[placeholder*="手机号"]').first().fill("13900000099");
  const pw = await p.locator('input[type="password"]').all();
  await pw[0].fill("Test1234");
  await pw[1].fill("Test1234");
  await p.locator("button.login-btn").click();
  await p.waitForURL("**/home*", {timeout:10000});
  await p.waitForTimeout(500);
  
  await p.goto("https://e9fcd454.beauty-api-pages.pages.dev/tier2-result?reportId=2dec662c-fe6e-4ec4-b9a6-7b41e59bf413", {waitUntil:"networkidle", timeout:20000});
  await p.waitForTimeout(5000);
  
  console.log("Console logs:");
  logs.forEach(l => console.log(" ", l));
  
  const info = await p.evaluate(() => ({
    historyState: JSON.stringify(window.history.state),
    urlParam: new URLSearchParams(window.location.search).get("reportId"),
    bodyText: document.body.innerText.substring(0, 300),
    token: localStorage.getItem("session_token") ? localStorage.getItem("session_token").slice(0,12) : "none"
  }));
  console.log(JSON.stringify(info, null, 2));
  await b.close();
})();
