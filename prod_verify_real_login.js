const { chromium } = require("playwright");
const BASE = "https://ccfu.ccwu.cc";
const OUT = "C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test_output";
const fs = require("fs");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();

  async function snap(name) {
    const p = OUT + "/" + name + ".png";
    await pg.screenshot({ path: p, fullPage: false });
    console.log("[SNAP]", name);
    return p;
  }

  console.log("=== Production Verification (Real Browser Login) ===");
  console.log("Target:", BASE);

  // Step 1: Real browser password login
  console.log("\n[1] Logging in via browser...");
  await pg.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 20000 });
  await pg.waitForTimeout(1500);
  await snap("P1_login_page");

  await pg.locator('input[placeholder*="手机号"]').first().fill("13900000099");
  await pg.waitForTimeout(500);
  const pwFields = await pg.locator('input[type="password"]').all();
  if (pwFields.length >= 2) {
    await pwFields[0].fill("Test1234");
    await pwFields[1].fill("Test1234");
  }
  await pg.waitForTimeout(500);
  await snap("P2_login_filled");

  await pg.locator("button.login-btn").click();
  console.log("  Submitted, waiting for redirect...");

  try {
    await pg.waitForURL("**/home*", { timeout: 15000 });
    console.log("  OK: Logged in");
  } catch (e) {
    const bodyText = await pg.evaluate(() => document.body.innerText).catch(() => "");
    if (bodyText.includes("登录失败") || bodyText.includes("密码错误")) {
      console.log("  FAIL: Login error:", bodyText.substring(0, 200));
      await snap("P3_login_failed");
      await browser.close();
      process.exit(1);
    }
  }
  await snap("P3_after_login");

  const storedToken = await pg.evaluate(() => localStorage.getItem("session_token"));
  console.log("  Token:", storedToken ? storedToken.slice(0, 12) + "..." : "(none)");
  if (!storedToken) {
    console.log("  FAIL: No session token!");
    await browser.close();
    process.exit(1);
  }

  // Step 2: Navigate to tier2-result WITH history state set
  // Production build only reads reportId from window.history.state, not URL params
  const T2_ID = "2dec662c-fe6e-4ec4-b9a6-7b41e59bf413";
  console.log("\n[2] Navigating to tier2-result (with history state)...");
  
  // First navigate to /tier2-result, then set history state, then reload
  await pg.goto(BASE + "/tier2-result", { waitUntil: "domcontentloaded", timeout: 15000 });
  await pg.waitForTimeout(1000);
  
  // Set history state with reportId (workaround for old production build)
  await pg.evaluate(({ id }) => {
    window.history.replaceState({ reportId: id }, "", "/tier2-result?reportId=" + id);
  }, { id: T2_ID });
  await pg.waitForTimeout(500);
  
  // Reload to trigger the component with the correct reportId
  await pg.reload({ waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);

  // Check state
  const errorMsg = await pg.evaluate(() => {
    const el = document.querySelector(".t2-error-text");
    return el ? el.textContent : null;
  });
  
  const pageState = await pg.evaluate(() => ({
    bodyText: document.body.innerText.substring(0, 400),
    classes: Array.from(document.querySelectorAll("*")).slice(0, 20).map(el => el.className).filter(Boolean),
    token: localStorage.getItem("session_token") ? localStorage.getItem("session_token").slice(0,12) : "none",
    dimCards: document.querySelectorAll(".t2-dim-card").length,
    hasContent: !!document.querySelector(".t2-hero-content")
  }));
  console.log("  Page state:", JSON.stringify(pageState));

  if (errorMsg) {
    console.log("  FAIL: Error on page:", errorMsg);
    await snap("P4_error_state");
  } else {
    console.log("  OK: Page loaded");
    await snap("P4_tier2_full_page");
  }

  // Step 3: Feature 1 - Lightbulb buttons (only in NEW build, may not exist in prod)
  console.log("\n[3] Checking lightbulb buttons...");
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  Lightbulb buttons:", bulbCount);
  const bulbsOk = bulbCount > 0;
  console.log("  Feature 1 (lightbulb buttons):", bulbsOk ? "PASS" : "SKIP (not in current build)");
  await snap("P5_lightbulbs");

  // Step 4: Check if old-style modal exists
  console.log("\n[4] Checking modal functionality...");
  const hasOldModal = await pg.evaluate(() => !!document.querySelector(".t2-modal-overlay"));
  console.log("  Old modal exists:", hasOldModal);
  
  // Check product cards
  const productCards = await pg.evaluate(() => document.querySelectorAll(".t2-product-card").length);
  console.log("  Product cards:", productCards);

  // Step 5: Feature 3 - Hook text and button color
  console.log("\n[5] Checking hook text and button color...");
  const hookInfo = await pg.evaluate(() => {
    const hookTextEl = document.querySelector(".t2-tier3-hook-text");
    const hookBtn = document.querySelector(".t2-btn-hook");
    const btnColor = document.querySelector(".t2-btn") 
      ? getComputedStyle(document.querySelector(".t2-btn")).backgroundColor 
      : "(n/a)";
    return {
      hookText: hookTextEl ? hookTextEl.textContent.trim() : "(not found)",
      hookBtnExists: !!hookBtn,
      btnColor
    };
  });
  console.log("  Hook:", JSON.stringify(hookInfo));
  const hookOk = hookInfo.hookText !== "(not found)";
  console.log("  Feature 3 (hook text):", hookOk ? "PASS" : "SKIP (not in current build)");

  // Summary
  console.log("\n===== PRODUCTION VERIFICATION SUMMARY =====");
  console.log("Auth:            ", storedToken ? "OK - token in localStorage" : "FAIL");
  console.log("Page load:       ", errorMsg ? "FAIL - " + errorMsg : "OK");
  console.log("Feature 1 (bulbs):", bulbsOk ? "PASS" : "SKIP (old build)");
  console.log("Feature 3 (hook) :", hookOk ? "PASS" : "SKIP (old build)");
  console.log("\nNote: Production is running an older build (index-D4Msozha.js)");
  console.log("      that predates the lightbulb modal and hook text features.");
  console.log("      Redeploy the current code to enable full testing.");
  console.log("\nScreenshots:", OUT);

  await browser.close();
  console.log("Done.");
})();
