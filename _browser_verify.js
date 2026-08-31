const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const TOKEN = "b41c375b-e449-4101-9820-2f94080df1de";
const TIER2_ID = "f137d988-c083-47a8-924c-c7ed9438cbe8";
const HOST = "https://f2e219a5.beauty-api-pages.pages.dev";
const OUT = "C:/Users/yao/Documents/ChatGPT/美妆app/test_output";

async function snap(pg, name) {
  const s = path.join(OUT, name + ".png");
  await pg.screenshot({ path: s, fullPage: false });
  console.log("  [SNAP] " + name);
  return s;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pg = await ctx.newPage();
  
  // Set session token via localStorage
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: TOKEN });
  
  console.log("Navigating to tier2-result page...");
  await pg.goto(HOST + "/tier2-result?reportId=" + TIER2_ID, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);
  await snap(pg, "browser_verify_tier2_page");
  console.log("  URL: " + pg.url());
  
  // Check lightbulb buttons
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  Lightbulb buttons found: " + bulbCount);
  
  // Check API data for this tier2 report
  const apiRes = await pg.evaluate(async ({ token, tier2Id }) => {
    const r = await fetch("/api/reports/mine", {
      headers: { "Authorization": "Bearer " + token }
    });
    const data = await r.json();
    const report = data.reports?.find(r => r.id === tier2Id);
    return report;
  }, { token: TOKEN, tier2Id: TIER2_ID });
  
  console.log("  API report dims: " + Object.keys(apiRes?.dimensions || {}).join(", "));
  
  // Click each lightbulb and verify modal content
  const results = [];
  for (let i = 0; i < Math.min(bulbCount, 6); i++) {
    try {
      await pg.locator(".t2-lightbulb-btn").nth(i).click();
      await pg.waitForTimeout(1500);
      await snap(pg, "browser_verify_modal_dim" + i);
      
      const modalCheck = await pg.evaluate(() => {
        const inner = document.querySelector(".t2-modal-overlay-inner");
        if (!inner) return { error: "no modal inner" };
        const cards = inner.querySelectorAll(".t2-product-card");
        const imgs = inner.querySelectorAll("img");
        const linkTexts = inner.querySelectorAll(".t2-product-link-text");
        const names = Array.from(inner.querySelectorAll(".t2-product-name")).map(el => el.textContent.trim().substring(0, 30));
        const imgSrcs = Array.from(imgs).map(el => el.src ? el.src.substring(0, 80) : "");
        const linkVals = Array.from(linkTexts).map(el => el.textContent.trim().substring(0, 60));
        return {
          cardCount: cards.length,
          imgCount: imgs.length,
          linkCount: linkTexts.length,
          names,
          imgSrcs,
          linkTexts: linkVals,
          anyImgVisible: imgs.length > 0 && Array.from(imgs).some(el => el.naturalWidth > 0),
        };
      });
      
      console.log("  Modal[" + i + "]: cards=" + modalCheck.cardCount + " imgs=" + modalCheck.imgCount + " links=" + modalCheck.linkCount + " anyVisible=" + modalCheck.anyImgVisible);
      if (modalCheck.error) {
        console.log("    ERROR: " + modalCheck.error);
      }
      results.push({ dim: i, check: modalCheck });
      
      try { await pg.locator(".t2-modal-close").click(); await pg.waitForTimeout(800); } catch (e) {}
    } catch (e) {
      console.log("  Modal[" + i + "] error: " + e.message);
      results.push({ dim: i, error: e.message });
    }
  }
  
  // Final screenshot
  await snap(pg, "browser_verify_final");
  
  // Summary
  console.log("\n=== Browser Verification Summary ===");
  console.log("  Deployment: " + HOST);
  console.log("  Token: " + TOKEN.substring(0, 12) + "...");
  console.log("  Tier2 ID: " + TIER2_ID);
  console.log("  Lightbulb buttons: " + bulbCount);
  console.log("  Modals checked: " + results.length);
  
  let allOk = true;
  for (const r of results) {
    if (r.error) { allOk = false; console.log("  FAIL modal[" + r.dim + "]: " + r.error); continue; }
    const ok = r.check.cardCount > 0 && r.check.anyImgVisible;
    if (!ok) allOk = false;
    console.log("  Modal[" + r.dim + "]: " + (ok ? "OK" : "INCOMPLETE") + " cards=" + r.check.cardCount + " imgs_visible=" + r.check.anyImgVisible);
  }
  console.log("  Overall: " + (allOk ? "PASS" : "ISSUES FOUND"));
  
  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("FATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
