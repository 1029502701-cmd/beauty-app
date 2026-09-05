const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({headless:true, args:["--no-sandbox"]});
  const page = await browser.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("session_token", "test-token-123");
  });

  await page.goto("https://ac56196a.beauty-api-pages.pages.dev/report", {waitUntil:"networkidle", timeout:30000});
  await page.waitForTimeout(2000);

  // Check initial state
  let body = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 600) : "");
  console.log("Initial body:", body.substring(0, 200));

  // Click upload button
  const uploadBtn = await page.locator("text=选择照片").first();
  await uploadBtn.click();
  console.log("Clicked upload button");

  // Upload a test image
  const imagePath = "C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg";
  const fileInput = await page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(imagePath);
  console.log("File uploaded");

  // Wait for analysis
  await page.waitForTimeout(8000);

  // Check result
  body = await page.evaluate(() => document.body ? document.body.innerText.substring(0, 800) : "");
  console.log("After upload body:", body);

  const hasReport = body.includes("分析结果") || body.includes("脸型");
  console.log("Has report data:", hasReport);

  await page.screenshot({path:"C:/Users/yao/Documents/ChatGPT/美妆app/test_after_upload.png"});
  console.log("Screenshot saved");
  await browser.close();
})();