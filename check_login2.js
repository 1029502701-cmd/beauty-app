const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("http://127.0.0.1:8788/login", { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  
  // Check all input fields
  const inputs = await p.$$eval('input', els => els.map(el => ({
    placeholder: el.placeholder,
    type: el.type,
    value: el.value,
    disabled: el.disabled,
    id: el.id,
    name: el.name
  })));
  console.log("Inputs:", JSON.stringify(inputs, null, 2));
  
  // Check button
  const btn = await p.$eval("button.login-btn", el => ({
    disabled: el.disabled,
    text: el.textContent.trim()
  }));
  console.log("Button:", JSON.stringify(btn));
  
  await b.close();
})();
