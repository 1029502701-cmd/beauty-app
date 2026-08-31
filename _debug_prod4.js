const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({headless:true});
  const c = await b.newContext();
  const p = await c.newPage();
  
  const responses = [];
  p.on("response", async resp => {
    const url = resp.url();
    if (url.includes("/api/")) {
      try {
        const status = resp.status();
        const body = await resp.text().catch(() => "");
        responses.push({ url: url.replace("https://e9fcd454.beauty-api-pages.pages.dev",""), status, body: body.substring(0, 200) });
      } catch {}
    }
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
  
  console.log("API calls made:");
  responses.forEach(r => console.log(" ", r.status, r.url, "-", r.body.substring(0,100)));
  
  const info = await p.evaluate(() => ({
    bodyText: document.body.innerText.substring(0, 300),
    classes: Array.from(document.querySelectorAll("*")).slice(0,20).map(el => el.className).filter(Boolean),
    token: localStorage.getItem("session_token") ? localStorage.getItem("session_token").slice(0,12) : "none"
  }));
  console.log(JSON.stringify(info, null, 2));
  await b.close();
})();
