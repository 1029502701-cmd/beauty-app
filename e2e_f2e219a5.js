const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const path = require("path");

const HOST = "https://f2e219a5.beauty-api-pages.pages.dev";
const OUT = "C:/Users/yao/Documents/ChatGPT/美妆app/test_output";

function apiPost(p, body, token) {
  return new Promise((res, rej) => {
    const d = JSON.stringify(body);
    const r = https.request({ hostname: "f2e219a5.beauty-api-pages.pages.dev", path: p, method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (token || ""), "Content-Length": Buffer.byteLength(d) }
    }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res({ raw: b.substring(0, 300) }); } }); });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(30000, () => { r.destroy(); res({ error: "timeout" }); });
    r.write(d); r.end();
  });
}
function apiGet(p, token) {
  return new Promise((res, rej) => {
    const hdrs = token ? { "Authorization": "Bearer " + token } : {};
    const r = https.request({ hostname: "f2e219a5.beauty-api-pages.pages.dev", path: p, method: "GET", headers: hdrs }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res(b); } }); });
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
  const NEW_PASS = "PicTest1";
  
  console.log("\n" + "=".repeat(60));
  console.log("  E2E Test: New Account -> Tier1(JSON) -> Tier2 Unlock -> Product Card Verify");
  console.log("  Host: " + HOST);
  console.log("  Account: " + NEW_PHONE);
  console.log("=".repeat(60) + "\n");
  
  // Step 1: Register
  console.log("[1/6] Registering new account...");
  const reg = await apiPost("/api/auth/register", { account: NEW_PHONE, password: NEW_PASS, confirmPassword: NEW_PASS });
  const token = reg.sessionId;
  console.log("  Register: " + (token ? "OK token=" + token.substring(0,12) : JSON.stringify(reg).substring(0,200)));
  if (!token) { console.log("FATAL: Registration failed"); await browser.close(); process.exit(1); }
  
  // Step 2: Tier1 analysis (JSON mode - no photo upload)
  console.log("\n[2/6] Running Tier1 analysis (JSON mode)...");
  const tier1 = await apiPost("/api/tier1/analyze", { reportId: "e2e-test-" + Date.now() }, token);
  const tier1Id = tier1.reportId;
  console.log("  Tier1: " + (tier1Id ? "OK reportId=" + tier1Id : JSON.stringify(tier1).substring(0,200)));
  if (!tier1Id) { console.log("FATAL: Tier1 failed"); await browser.close(); process.exit(1); }
  
  // Step 3: Navigate to tier1 result page and take screenshot
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: token });
  await pg.goto(HOST + "/tier1-result?reportId=" + tier1Id, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(3000);
  await snap(pg, "e2e_tier1_result");
  console.log("  URL: " + pg.url());
  
  // Step 4: Unlock Tier2 via ad (simulated - call the unlock API directly)
  console.log("\n[3/6] Unlocking Tier2 via ad...");
  const unlock = await apiPost("/api/tier2/unlock-by-ad", { reportId: tier1Id }, token);
  console.log("  Unlock: " + JSON.stringify(unlock).substring(0, 200));
  
  // Step 5: Wait and generate Tier2
  console.log("\n[4/6] Generating Tier2 report...");
  let tier2Id = null;
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise(r => setTimeout(r, 5000));
    const mine = await apiGet("/api/reports/mine", token);
    const reports = mine.reports || [];
    const t2 = reports.find(r => r.report_type === "tier2" && r.tier1_report_id === tier1Id);
    if (t2) {
      tier2Id = t2.id;
      console.log("  Tier2 found: " + tier2Id + " status=" + t2.status);
      if (t2.status === "completed") break;
    }
  }
  
  if (!tier2Id) {
    // Try generating directly
    console.log("  Tier2 not found, triggering generation...");
    const gen = await apiPost("/api/tier2/generate", { tier1ReportId: tier1Id }, token);
    console.log("  Generate: " + JSON.stringify(gen).substring(0, 200));
    tier2Id = gen.reportId || gen.id;
    
    // Wait for generation
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise(r => setTimeout(r, 5000));
      const mine = await apiGet("/api/reports/mine", token);
      const reports = mine.reports || [];
      const t2 = reports.find(r => r.report_type === "tier2" && r.tier1_report_id === tier1Id);
      if (t2 && t2.status === "completed") {
        tier2Id = t2.id;
        console.log("  Tier2 completed: " + tier2Id);
        break;
      }
      console.log("  Waiting... attempt " + (attempt+1));
    }
  }
  
  console.log("  Final Tier2 ID: " + tier2Id);
  if (!tier2Id) { console.log("FATAL: Tier2 generation failed"); await browser.close(); process.exit(1); }
  
  // Save tier2Id for later
  fs.writeFileSync(path.join(OUT, "e2e_new_tier2.txt"), tier2Id);
  fs.writeFileSync(path.join(OUT, "e2e_new_token.txt"), token);
  
  // Step 6: Browser verification
  console.log("\n[5/6] Browser verification of Tier2 page...");
  await pg.goto(HOST + "/tier2-result?reportId=" + tier2Id, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);
  await snap(pg, "e2e_tier2_full_page");
  console.log("  URL: " + pg.url());
  
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  Lightbulb buttons: " + bulbCount);
  
  // Get API data for verification
  const apiData = await apiGet("/api/reports/mine", token);
  const reports = apiData.reports || [];
  const t2Report = reports.find(r => r.id === tier2Id);
  console.log("  Tier2 API dims: " + Object.keys(t2Report?.dimensions || {}).join(", "));
  
  const allResults = [];
  const modalScreenshots = [];
  
  for (let i = 0; i < Math.min(bulbCount, 6); i++) {
    try {
      await pg.locator(".t2-lightbulb-btn").nth(i).click();
      await pg.waitForTimeout(1500);
      const snapName = "e2e_modal_dim" + i;
      await snap(pg, snapName);
      modalScreenshots.push(path.join(OUT, snapName + ".png"));
      
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
          cardCount: cards.length, imgCount: imgs.length, linkCount: linkTexts.length,
          names, imgSrcs, linkTexts: linkVals,
          anyImgVisible: imgs.length > 0 && Array.from(imgs).some(el => el.naturalWidth > 0),
        };
      });
      
      console.log("  Modal[" + i + "]: cards=" + modalCheck.cardCount + " imgs=" + modalCheck.imgCount + " links=" + modalCheck.linkCount + " visible=" + modalCheck.anyImgVisible);
      if (modalCheck.error) console.log("    ERROR: " + modalCheck.error);
      
      allResults.push({ dim: i, check: modalCheck });
      
      try { await pg.locator(".t2-modal-close").click(); await pg.waitForTimeout(800); } catch (e) {}
    } catch (e) {
      console.log("  Modal[" + i + "] error: " + e.message);
      allResults.push({ dim: i, error: e.message });
    }
  }
  
  await snap(pg, "e2e_final");
  
  // API-level product verification
  console.log("\n[6/6] API-level product verification...");
  const dims = t2Report?.dimensions || {};
  let totalItems = 0, imgOk = 0, linkOk = 0;
  for (const [dim, items] of Object.entries(dims)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      totalItems++;
      const hasImg = !!(item.imageUrl && item.imageUrl.startsWith("http"));
      const hasLink = !!(item.itemUrl && item.itemUrl.startsWith("http"));
      if (hasImg) imgOk++;
      if (hasLink) linkOk++;
      console.log("  [" + dim + "] " + (item.name || "").substring(0, 30) + " img=" + hasImg + " link=" + hasLink);
    }
  }
  console.log("  API products: " + totalItems + " total | images: " + imgOk + "/" + totalItems + " | links: " + linkOk + "/" + totalItems);
  
  // Browser-level verification summary
  console.log("\n" + "=".repeat(60));
  console.log("  E2E Test Results");
  console.log("=".repeat(60));
  console.log("  Account: " + NEW_PHONE);
  console.log("  Tier1 ID: " + tier1Id);
  console.log("  Tier2 ID: " + tier2Id);
  console.log("  Lightbulb buttons: " + bulbCount);
  console.log("  API products: " + totalItems + " | images: " + imgOk + " | links: " + linkOk);
  
  let modalOk = true;
  for (const r of allResults) {
    if (r.error) { modalOk = false; continue; }
    const ok = r.check.cardCount > 0 && r.check.anyImgVisible;
    if (!ok) modalOk = false;
    console.log("  Modal[" + r.dim + "]: " + (ok ? "OK" : "INCOMPLETE") + " cards=" + r.check.cardCount + " imgs_visible=" + r.check.anyImgVisible);
  }
  console.log("  Modal rendering: " + (modalOk ? "PASS" : "ISSUES"));
  console.log("  Screenshots: " + (2 + modalScreenshots.length + 1) + " files in test_output/");
  console.log("=".repeat(60));
  
  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("FATAL:", e.message);
  console.error(e.stack);
  process.exit(1);
});
