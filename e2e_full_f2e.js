const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const path = require("path");

const HOST = "f2e219a5.beauty-api-pages.pages.dev";
const OUT = "C:/Users/yao/Documents/ChatGPT/美妆app/test_output";

function apiPost(p, body, token) {
  return new Promise((res) => {
    const d = JSON.stringify(body);
    const r = https.request({ hostname: HOST, path: p, method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "Content-Length": Buffer.byteLength(d) }
    }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res({ raw: b.substring(0, 300) }); } }); });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(30000, () => { r.destroy(); res({ error: "timeout" }); });
    r.write(d); r.end();
  });
}
function apiGet(p, token) {
  return new Promise((res) => {
    const r = https.request({ hostname: HOST, path: p, method: "GET",
      headers: token ? { "Authorization": "Bearer " + token } : {}
    }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res({ raw: b.substring(0, 300) }); } }); });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(30000, () => { r.destroy(); res({ error: "timeout" }); });
    r.end();
  });
}

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
  
  const NEW_PHONE = "1" + Date.now().toString().slice(-10);
  
  console.log("\n" + "=".repeat(60));
  console.log("  Full E2E: Register -> Tier1 -> Tier2 Unlock+Generate -> Verify");
  console.log("  Host: " + HOST);
  console.log("  Account: " + NEW_PHONE);
  console.log("=".repeat(60) + "\n");
  
  // 1. Register
  console.log("[1] Register...");
  const reg = await apiPost("/api/auth/register", { account: NEW_PHONE, password: "PicTest1", confirmPassword: "PicTest1" });
  const token = reg.sessionId;
  console.log("  Token: " + (token ? token.substring(0,12) : "FAIL"));
  if (!token) { console.log("FATAL"); await browser.close(); process.exit(1); }
  
  // 2. Tier1 (JSON mode)
  console.log("\n[2] Tier1 analysis...");
  const t1 = await apiPost("/api/tier1/analyze", { reportId: "e2e-" + Date.now() }, token);
  const tier1Id = t1.reportId;
  console.log("  Tier1 ID: " + tier1Id);
  if (!tier1Id) { console.log("FATAL: " + JSON.stringify(t1).substring(0,200)); await browser.close(); process.exit(1); }
  
  // 3. Unlock Tier2 via ad
  console.log("\n[3] Unlock Tier2 via ad...");
  const unlock = await apiPost("/api/tier2/unlock-by-ad", { tier1ReportId: tier1Id }, token);
  const tier2Id = unlock.tier2ReportId;
  console.log("  Tier2 ID: " + tier2Id);
  if (!tier2Id) { console.log("FATAL: " + JSON.stringify(unlock).substring(0,200)); await browser.close(); process.exit(1); }
  
  // 4. Generate Tier2
  console.log("\n[4] Generating Tier2...");
  await apiPost("/api/tier2/generate", { reportId: tier2Id }, token);
  
  // Poll until ready
  let tier2Content = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const status = await apiGet("/api/tier2/status?tier2Id=" + tier2Id, token);
    if (status.generationStatus === "ready" && status.content) {
      tier2Content = status.content;
      console.log("  Generated! content keys: " + Object.keys(status.content).join(", "));
      console.log("  productRecs keys: " + Object.keys(status.content.productRecs || {}).join(", "));
      break;
    }
    if (status.generationStatus === "failed") {
      console.log("  FAILED");
      break;
    }
    if (i % 5 === 4) console.log("  Waiting... (" + (i+1) + ")");
  }
  
  if (!tier2Content) {
    console.log("FATAL: Tier2 generation never completed");
    await browser.close(); process.exit(1);
  }
  
  // 5. Verify products have images and links
  console.log("\n[5] Verifying product enrichment...");
  const productRecs = tier2Content.productRecs || {};
  let total = 0, withImg = 0, withLink = 0, withPrice = 0;
  for (const [dim, items] of Object.entries(productRecs)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      total++;
      const hasImg = !!(item.imageUrl && item.imageUrl.startsWith("http"));
      const hasLink = !!(item.itemUrl && item.itemUrl.startsWith("http"));
      const hasPrice = !!item.price;
      if (hasImg) withImg++;
      if (hasLink) withLink++;
      if (hasPrice) withPrice++;
      console.log("  [" + dim + "] " + (item.name || "?").substring(0,35) + " img=" + hasImg + " link=" + hasLink + " price=" + hasPrice);
    }
  }
  console.log("  Total: " + total + " | Images: " + withImg + "/" + total + " | Links: " + withLink + "/" + total + " | Prices: " + withPrice + "/" + total);
  
  // 6. Browser verification
  console.log("\n[6] Browser verification...");
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: token });
  await pg.goto(HOST + "/tier2-result?reportId=" + tier2Id, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);
  await snap(pg, "e2e_browser_tier2_page");
  console.log("  URL: " + pg.url());
  
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  Lightbulb buttons: " + bulbCount);
  
  const modalResults = [];
  for (let i = 0; i < Math.min(bulbCount, 6); i++) {
    try {
      await pg.locator(".t2-lightbulb-btn").nth(i).click();
      await pg.waitForTimeout(1500);
      await snap(pg, "e2e_browser_modal_" + i);
      
      const check = await pg.evaluate(() => {
        const inner = document.querySelector(".t2-modal-overlay-inner");
        if (!inner) return { error: "no modal" };
        const cards = inner.querySelectorAll(".t2-product-card");
        const imgs = inner.querySelectorAll("img");
        const linkTexts = inner.querySelectorAll(".t2-product-link-text");
        const names = Array.from(inner.querySelectorAll(".t2-product-name")).map(el => el.textContent.trim().substring(0,30));
        const imgSrcs = Array.from(imgs).map(el => el.src ? el.src.substring(0,80) : "");
        const linkVals = Array.from(linkTexts).map(el => el.textContent.trim().substring(0,60));
        return {
          cardCount: cards.length,
          imgCount: imgs.length,
          linkCount: linkTexts.length,
          names, imgSrcs, linkTexts: linkVals,
          anyImgVisible: imgs.length > 0 && Array.from(imgs).some(el => el.naturalWidth > 0),
          anyLinkVisible: linkTexts.length > 0,
        };
      });
      
      console.log("  Modal[" + i + "]: cards=" + check.cardCount + " imgs=" + check.imgCount + " links=" + check.linkCount + " visible=" + check.anyImgVisible + " linksVisible=" + check.anyLinkVisible);
      if (check.error) console.log("    ERROR: " + check.error);
      modalResults.push({ dim: i, check });
      
      try { await pg.locator(".t2-modal-close").click(); await pg.waitForTimeout(800); } catch (e) {}
    } catch (e) {
      console.log("  Modal[" + i + "] error: " + e.message);
      modalResults.push({ dim: i, error: e.message });
    }
  }
  
  await snap(pg, "e2e_browser_final");
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("  RESULTS");
  console.log("=".repeat(60));
  console.log("  Account: " + NEW_PHONE);
  console.log("  Tier1: " + tier1Id);
  console.log("  Tier2: " + tier2Id);
  console.log("  Products enriched: " + total + " | with images: " + withImg + " | with Taobao links: " + withLink);
  console.log("  Modal cards rendered: " + modalResults.filter(r => !r.error && r.check.cardCount > 0).length + "/" + modalResults.length);
  console.log("  Modal images visible: " + modalResults.filter(r => !r.error && r.check.anyImgVisible).length + "/" + modalResults.length);
  console.log("  Modal links visible: " + modalResults.filter(r => !r.error && r.check.anyLinkVisible).length + "/" + modalResults.length);
  
  const apiOk = withImg > 0 && withLink > 0;
  const modalOk = modalResults.every(r => !r.error && r.check.cardCount > 0);
  console.log("  API enrichment: " + (apiOk ? "PASS" : "FAIL"));
  console.log("  Browser rendering: " + (modalOk ? "PASS" : "FAIL"));
  console.log("=".repeat(60));
  
  fs.writeFileSync(path.join(OUT, "e2e_f2e_token.txt"), token);
  fs.writeFileSync(path.join(OUT, "e2e_f2e_tier2.txt"), tier2Id);
  
  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("FATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
