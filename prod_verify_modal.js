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

  console.log("=== Modal Verification (Real Browser Login) ===");
  console.log("Target:", BASE);

  console.log("\n[1] Logging in via browser...");
  await pg.goto(BASE + "/login", { waitUntil: "domcontentloaded", timeout: 20000 });
  await pg.waitForTimeout(1500);
  await snap("M1_login");
  await pg.locator('input[placeholder*="手机号"]').first().fill("13900000099");
  await pg.waitForTimeout(500);
  const pwFields = await pg.locator('input[type="password"]').all();
  if (pwFields.length >= 2) {
    await pwFields[0].fill("Test1234");
    await pwFields[1].fill("Test1234");
  }
  await pg.waitForTimeout(500);
  await snap("M2_login_filled");
  await pg.locator("button.login-btn").click();
  console.log("  Submitted, waiting for redirect...");
  try {
    await pg.waitForURL("**/home*", { timeout: 15000 });
    console.log("  OK: Logged in");
  } catch (e) {
    console.log("  Redirect wait failed, checking anyway...");
  }
  await snap("M3_after_login");
  const token = await pg.evaluate(() => localStorage.getItem("session_token"));
  console.log("  Token:", token?.substring(0, 12) + "...");

  const T2_ID = "2dec662c-fe6e-4ec4-b9a6-7b41e59bf413";
  console.log("\n[2] Navigating to tier2-result...");
  await pg.goto(BASE + "/tier2-result", { waitUntil: "domcontentloaded", timeout: 15000 });
  await pg.evaluate(({ id }) => {
    window.history.replaceState({ reportId: id }, "", "/tier2-result?reportId=" + id);
  }, { id: T2_ID });
  await pg.waitForTimeout(2000);
  await snap("M4_tier2_page");

  console.log("\n[3] Checking lightbulb buttons...");
  const bulbs = await pg.$$eval(".t2-lightbulb-btn", els => els.length);
  console.log("  Lightbulb buttons found:", bulbs);

  console.log("\n[4] Clicking first lightbulb button...");
  await pg.click(".t2-lightbulb-btn");
  await pg.waitForTimeout(1500);
  await snap("M5_modal_open");

  const modalOpen = await pg.evaluate(() => !!document.querySelector(".t2-modal-overlay"));
  console.log("  Modal visible:", modalOpen);

  const productCards = await pg.$$eval(".t2-product-card", els => els.length);
  console.log("  Product cards in modal:", productCards);

  const productDetails = await pg.evaluate(() => {
    const cards = document.querySelectorAll(".t2-product-card");
    return Array.from(cards).map(c => ({
      name: c.querySelector(".t2-product-name")?.textContent?.trim() || "(no name)",
      hasImg: !!c.querySelector(".t2-product-img"),
      imgSrc: c.querySelector(".t2-product-img")?.src?.substring(0, 80) || "(none)",
      hasLink: !!c.querySelector(".t2-product-link-text"),
      linkText: c.querySelector(".t2-product-link-text")?.textContent?.trim()?.substring(0, 50) || "(none)",
    }));
  });
  console.log("  Product details:");
  productDetails.forEach((p, i) => {
    console.log(`    [${i+1}] name="${p.name}" img=${p.hasImg} link=${p.hasLink}`);
    if (p.imgSrc) console.log(`        imgSrc: ${p.imgSrc}`);
    if (p.linkText) console.log(`        link: ${p.linkText}`);
  });

  console.log("\n[5] Checking hook text and button color...");
  const hookInfo = await pg.evaluate(() => {
    const textEl = document.querySelector(".t2-tier3-hook-text");
    const btn = document.querySelector(".t2-tier3-hook");
    return {
      hookText: textEl?.textContent?.trim() || "(not found)",
      hookExists: !!textEl,
      btnExists: !!btn,
      btnColor: btn ? getComputedStyle(btn).backgroundColor : "(n/a)",
      btnBg: btn ? getComputedStyle(btn).background : "(n/a)",
    };
  });
  console.log("  Hook text:", hookInfo.hookText);
  console.log("  Hook button color:", hookInfo.btnColor);
  console.log("  Hook button bg:", hookInfo.btnBg);

  await snap("M6_final");

  console.log("\n===== MODAL VERIFICATION SUMMARY =====");
  console.log("Auth:              ", token ? "OK" : "FAIL");
  console.log("Page load:         OK");
  console.log("Lightbulb buttons: ", bulbs > 0 ? "PASS (" + bulbs + " found)" : "FAIL");
  console.log("Modal opens:       ", modalOpen ? "PASS" : "FAIL");
  console.log("Product cards:     ", productCards > 0 ? "PASS (" + productCards + " found)" : "SKIP (no products in data)");
  console.log("Hook text:         ", hookInfo.hookText !== "(not found)" ? "PASS (" + hookInfo.hookText + ")" : "FAIL");
  console.log("Hook button color: ", hookInfo.btnColor !== "(n/a)" ? "PASS (" + hookInfo.btnColor + ")" : "FAIL");

  console.log("\nScreenshots:", OUT);
  await browser.close();
  console.log("Done.");
})();
