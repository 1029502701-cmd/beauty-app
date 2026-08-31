const { chromium } = require("playwright");
const path = require("path");
const https = require("https");
const fs = require("fs");

const HOST = "https://896dde93.beauty-api-pages.pages.dev";
const OUT = "C:/Users/yao/Documents/ChatGPT/美妆app/test_output";

function apiPost(p, body, token) {
  return new Promise((res) => {
    const d = JSON.stringify(body);
    const r = https.request({ hostname: "896dde93.beauty-api-pages.pages.dev", path: p, method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "Content-Length": Buffer.byteLength(d) }
    }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res({ raw: b.substring(0, 300) }); } }); });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(30000, () => { r.destroy(); res({ error: "timeout" }); });
    r.write(d); r.end();
  });
}
function apiGet(p, token) {
  return new Promise((res) => {
    const r = https.request({ hostname: "896dde93.beauty-api-pages.pages.dev", path: p, method: "GET",
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
  
  pg.on("console", msg => { if (msg.type() === "error") console.log("  [ERR] " + msg.text()); });
  pg.on("pageerror", err => console.log("  [PAGEERR] " + err.message));
  
  const NEW_PHONE = "1" + Date.now().toString().slice(-10);
  
  console.log("\n" + "=".repeat(60));
  console.log("  Full E2E on 896dde93");
  console.log("  Account: " + NEW_PHONE);
  console.log("=".repeat(60) + "\n");
  
  // Register
  const reg = await apiPost("/api/auth/register", { account: NEW_PHONE, password: "PicTest1", confirmPassword: "PicTest1" });
  const token = reg.sessionId;
  console.log("[1] Register: " + (token ? "OK " + token.substring(0,12) : JSON.stringify(reg).substring(0,200)));
  if (!token) { await browser.close(); process.exit(1); }
  
  // Tier1
  const t1 = await apiPost("/api/tier1/analyze", { reportId: "e2e-" + Date.now() }, token);
  const tier1Id = t1.reportId;
  console.log("[2] Tier1: " + (tier1Id ? "OK " + tier1Id : JSON.stringify(t1).substring(0,200)));
  if (!tier1Id) { await browser.close(); process.exit(1); }
  
  // Unlock Tier2
  const unlock = await apiPost("/api/tier2/unlock-by-ad", { tier1ReportId: tier1Id }, token);
  const tier2Id = unlock.tier2ReportId;
  console.log("[3] Unlock: " + (tier2Id ? "OK " + tier2Id : JSON.stringify(unlock).substring(0,200)));
  if (!tier2Id) { await browser.close(); process.exit(1); }
  
  // Generate
  await apiPost("/api/tier2/generate", { reportId: tier2Id }, token);
  console.log("[4] Generate triggered");
  
  // Poll
  let tier2Content = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const status = await apiGet("/api/tier2/status?tier2Id=" + tier2Id, token);
    if (status.generationStatus === "ready" && status.content) {
      tier2Content = status.content;
      console.log("[5] Generated! productRecs keys: " + Object.keys(status.content.productRecs || {}).join(", "));
      break;
    }
    if (status.generationStatus === "failed") { console.log("  FAILED"); break; }
    if (i % 5 === 4) console.log("  Waiting... (" + (i+1) + ")");
  }
  
  if (!tier2Content) {
    console.log("FATAL: Tier2 not generated");
    await browser.close(); process.exit(1);
  }
  
  // Verify products
  const pr = tier2Content.productRecs || {};
  let total = 0, withImg = 0, withLink = 0;
  for (const items of Object.values(pr)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      total++;
      if (item.imageUrl?.startsWith("http")) withImg++;
      if (item.itemUrl?.startsWith("http")) withLink++;
    }
  }
  console.log("[6] Products: " + total + " | images: " + withImg + "/" + total + " | links: " + withLink + "/" + total);
  
  // Browser verification
  console.log("\n[7] Browser verification...");
  await pg.addInitScript(({ t }) => { localStorage.setItem("n", t); }, { t: token });
  await pg.goto(HOST + "/tier2-result?reportId=" + tier2Id, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);
  await snap(pg, "e2e_896_tier2_page");
  console.log("  URL: " + pg.url());
  console.log("  Title: " + await pg.title());
  
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  Lightbulb buttons: " + bulbCount);
  
  for (let i = 0; i < Math.min(bulbCount, 6); i++) {
    try {
      await pg.locator(".t2-lightbulb-btn").nth(i).click();
      await pg.waitForTimeout(1500);
      await snap(pg, "e2e_896_modal_" + i);
      
      const check = await pg.evaluate(() => {
        const inner = document.querySelector(".t2-modal-overlay-inner");
        if (!inner) return { error: "no modal" };
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
      
      try { await pg.locator(".t2-modal-close").click(); await pg.waitForTimeout(800); } catch (e) {}
    } catch (e) {
      console.log("  Modal[" + i + "] error: " + e.message);
    }
  }
  
  await snap(pg, "e2e_896_final");
  
  console.log("\n" + "=".repeat(60));
  console.log("  RESULTS for 896dde93");
  console.log("  Account: " + NEW_PHONE);
  console.log("  Tier1: " + tier1Id);
  console.log("  Tier2: " + tier2Id);
  console.log("  Products: " + total + " | images: " + withImg + " | links: " + withLink);
  console.log("  API enrichment: " + (withImg > 0 && withLink > 0 ? "PASS" : "FAIL"));
  console.log("=".repeat(60));
  
  fs.writeFileSync(path.join(OUT, "e2e_896_token.txt"), token);
  fs.writeFileSync(path.join(OUT, "e2e_896_tier2.txt"), tier2Id);
  
  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
