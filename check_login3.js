const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("http://127.0.0.1:8788/login", { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  
  await p.fill('input[placeholder*="手机"]', "13998966531");
  await p.fill('input[placeholder*="密码"]', "TestPass123");
  await p.fill('input[placeholder*="再次"]', "TestPass123");
  await p.waitForTimeout(500);
  
  const btn = await p.$eval("button.login-btn", el => ({
    disabled: el.disabled,
    text: el.textContent.trim()
  }));
  console.log("Button:", JSON.stringify(btn));
  
  await b.close();
})();
