const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const TOKEN = "6e6ffc12-41c"; // Will be overwritten
const TIER2_ID = "6d954995-fb15-4135-a4a3-e8d922d2cb95";
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
  
  console.log("Navigating to Tier2 page...");
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: TOKEN });
  await pg.goto(HOST + "/tier2-result?reportId=" + TIER2_ID, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);
  await snap(pg, "browser_f2e_tier2_page");
  console.log("  URL: " + pg.url());
  
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  Lightbulb buttons: " + bulbCount);
  
  if (bulbCount === 0) {
    console.log("  No lightbulb buttons found. Checking page content...");
    const bodyText = await pg.evaluate(() => document.body.innerText.substring(0, 500));
    console.log("  Page text: " + bodyText);
  }
  
  for (let i = 0; i < Math.min(bulbCount, 6); i++) {
    try {
      await pg.locator(".t2-lightbulb-btn").nth(i).click();
      await pg.waitForTimeout(1500);
      await snap(pg, "browser_f2e_modal_" + i);
      
      const check = await pg.evaluate(() => {
        const inner = document.querySelector(".t2-modal-overlay-inner");
        if (!inner) return { error: "no modal inner" };
        const cards = inner.querySelectorAll(".t2-product-card");
        const imgs = inner.querySelectorAll("img");
        const linkTexts = inner.querySelectorAll(".t2-product-link-text");
        const names = Array.from(inner.querySelectorAll(".t2-product-name")).map(el => el.textContent.trim().substring(0, 30));
        const imgSrcs = Array.from(imgs).map(el => el.src ? el.src.substring(0, 80) : "");
        const linkVals = Array.from(linkTexts).map(el => el.textContent.trim().substring(0, 60));
        return {
          cardCount: cards.length, imgCount: imgs.length, linkCount: linkTexts.length,
          names, imgSrcs, linkTexts: linkVals,
          anyImgVisible: imgs.length > 0 && Array.from(imgs).some(el => el.naturalWidth > 0),
          anyLinkVisible: linkTexts.length > 0,
        };
      });
      
      console.log("  Modal[" + i + "]: cards=" + check.cardCount + " imgs=" + check.imgCount + " links=" + check.linkCount + " imgVisible=" + check.anyImgVisible + " linkVisible=" + check.anyLinkVisible);
      if (check.error) console.log("    ERROR: " + check.error);
      
      try { await pg.locator(".t2-modal-close").click(); await pg.waitForTimeout(800); } catch (e) {}
    } catch (e) {
      console.log("  Modal[" + i + "] error: " + e.message);
    }
  }
  
  await snap(pg, "browser_f2e_final");
  console.log("\nDone! Check test_output/ for screenshots.");
  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
