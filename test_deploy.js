const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  try {
    await page.goto("https://ac56196a.beauty-api-pages.pages.dev/home", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Fill phone and password for login
    const phoneInputs = await page.locator('input[type="tel"]').all();
    console.log("Phone inputs:", phoneInputs.length);
    if (phoneInputs.length > 0) {
      await phoneInputs[0].fill("13900000001");
    }
    
    const passInputs = await page.locator('input[type="password"]').all();
    console.log("Password inputs:", passInputs.length);
    if (passInputs.length > 0) {
      await passInputs[0].fill("Test1234");
    }
    
    await page.screenshot({ path: "C:/Users/yao/Documents/ChatGPT/美妆app/test_login_filled.png" });
    console.log("Screenshot saved");
    
    // Click login button
    const buttons = await page.locator("button").all();
    for (const btn of buttons) {
      const text = await btn.textContent();
      if (text && text.includes("登")) {
        await btn.click();
        console.log("Clicked login button");
        break;
      }
    }
    
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    console.log("Current URL:", currentUrl);
    
    await page.screenshot({ path: "C:/Users/yao/Documents/ChatGPT/美妆app/test_after_login.png" });
    console.log("Errors:", errors);
  } catch (e) {
    console.log("Exception:", e.message);
  }
  await browser.close();
})();