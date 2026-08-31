const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const TOKEN = "6e6ffc12-41c";
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
  
  // Set localStorage with the CORRECT key 'n'
  await pg.addInitScript(({ t }) => { localStorage.setItem("n", t); }, { t: TOKEN });
  
  console.log("Navigating to Tier2 page...");
  await pg.goto(HOST + "/tier2-result?reportId=" + TIER2_ID, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);
  await snap(pg, "browser_f2e_tier2_page");
  console.log("  URL: " + pg.url());
  
  // Check page content
  const pageTitle = await pg.title();
  console.log("  Page title: " + pageTitle);
  
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  Lightbulb buttons: " + bulbCount);
  
  if (bulbCount === 0) {
    const bodyText = await pg.evaluate(() => document.body.innerText.substring(0, 500));
    console.log("  Body text: " + bodyText);
    const html = await pg.evaluate(() => document.body.innerHTML.substring(0, 500));
    console.log("  HTML: " + html);
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
        return {
          cardCount: cards.length, imgCount: imgs.length, linkCount: linkTexts.length,
          anyImgVisible: imgs.length > 0 && Array.from(imgs).some(el => el.naturalWidth > 0),
          anyLinkVisible: linkTexts.length > 0,
        };
      });
      
      console.log("  Modal[" + i + "]: cards=" + check.cardCount + " imgs=" + check.imgCount + " links=" + check.linkCount + " imgVis=" + check.anyImgVisible + " linkVis=" + check.anyLinkVisible);
      if (check.error) console.log("    ERROR: " + check.error);
      
      try { await pg.locator(".t2-modal-close").click(); await pg.waitForTimeout(800); } catch (e) {}
    } catch (e) {
      console.log("  Modal[" + i + "] error: " + e.message);
    }
  }
  
  await snap(pg, "browser_f2e_final");
  console.log("\nDone!");
  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
