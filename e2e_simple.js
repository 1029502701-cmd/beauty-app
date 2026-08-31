const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const apiCalls = [];
  page.on("request", req => {
    const u = req.url();
    if (u.includes("/api/")) apiCalls.push({ t: Date.now(), method: req.method(), url: u });
  });
  page.on("response", async resp => {
    const u = resp.url();
    if (u.includes("/api/")) {
      try {
        const body = await resp.text();
        console.log("RESP " + resp.status() + " " + u.substring(u.indexOf("/api/")) + " -> " + body.substring(0, 150));
      } catch {}
    }
  });
  
  await page.addInitScript(() => localStorage.setItem("session_token", "8f4873ff-746d-4170-9308-90b106aea95a"));
  
  console.log("NAVIGATING...");
  await page.goto("http://localhost:5174/report?id=44ef8170-9176-40f2-ba2b-7aabb6802ada", { waitUntil: "networkidle", timeout: 30000 });
  console.log("WAITING 5s...");
  await page.waitForTimeout(5000);
  
  console.log("CLICKING 进阶...");
  const advBtn = await page.$("text=进阶");
  if (advBtn) {
    await advBtn.click();
    console.log("CLICKED");
  } else {
    console.log("NOT FOUND");
  }
  await page.waitForTimeout(3000);
  
  const text = await page.textContent("body");
  console.log("BODY:", text.substring(0, 600));
  console.log("API calls made:", apiCalls.length);
  apiCalls.forEach(c => console.log("  " + c.method + " " + c.url.substring(c.url.indexOf("/api/"))));
  
  await page.screenshot({ path: "test_output/e2e_final_debug.png", fullPage: true });
  console.log("[SCREENSHOT] e2e_final_debug.png");
  
  await browser.close();
  console.log("DONE");
})();
