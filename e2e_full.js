const https = require('https');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const PROD_HOST = "81eba90d.beauty-api-pages.pages.dev";
const OUT = path.join(process.cwd(), "test_output");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const PHOTO_PATH = path.join(process.cwd(), "test_face.jpg");
const NEW_PHONE = "13" + String(Date.now()).slice(-9);
const NEW_PASSWORD = "TestPic" + String(Date.now()).slice(-4);

function apiPost(p, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: PROD_HOST, path: p, method: "POST", headers: hdrs }, x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); });
    r.on("error", rej); r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
    r.write(JSON.stringify(body)); r.end();
  });
}
function apiGet(p, token) {
  return new Promise((res, rej) => {
    const r = https.request({ hostname: PROD_HOST, path: p, method: "GET", headers: token ? { "Authorization": "Bearer " + token } : {} }, x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); });
    r.on("error", rej); r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end();
  });
}
function apiMultipartPost(p, fieldName, filePath, token) {
  return new Promise((res, rej) => {
    const bnd = "----E2EBoundary" + Date.now();
    const buf = fs.readFileSync(filePath);
    const c1 = Buffer.from("--" + bnd + "\r\nContent-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n");
    const c2 = Buffer.from("\r\n--" + bnd + "--\r\n");
    const body = Buffer.concat([c1, buf, c2]);
    const hdrs = { "Content-Type": "multipart/form-data; boundary=" + bnd };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: PROD_HOST, path: p, method: "POST", headers: hdrs }, x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); });
    r.on("error", rej); r.setTimeout(60000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end(body);
  });
}
async function snap(browser, name) {
  const pg = await browser.newPage();
  const s = path.join(OUT, name + ".png");
  await pg.screenshot({ path: s, fullPage: false });
  console.log("[SNAP] " + name);
  return pg;
}

(async () => {
  console.log("\n========================================");
  console.log("  FULL E2E on 81eba90d (with enrichment)");
  console.log("  Phone: " + NEW_PHONE);
  console.log("========================================\n");

  const regRes = await apiPost("/api/auth/register", { account: NEW_PHONE, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
  console.log("[1] Register:", JSON.stringify(regRes).substring(0, 200));
  const token = regRes.sessionId || regRes.token;

  const loginRes = await apiPost("/api/auth/phone/login-password", { phone: NEW_PHONE, password: NEW_PASSWORD });
  console.log("[2] Login:", JSON.stringify(loginRes).substring(0, 200));
  const t = loginRes.sessionId || loginRes.token;

  const t1Res = await apiMultipartPost("/api/tier1/analyze", "photo", PHOTO_PATH, t);
  console.log("[3] Tier1 reportId:", t1Res.reportId);
  const tier1ReportId = t1Res.reportId;

  const shareRes = await apiPost("/api/tier1/share", { reportId: tier1ReportId }, t);
  console.log("[4] Share tier2ReportId:", shareRes.tier2ReportId);
  const tier2ReportId = shareRes.tier2ReportId;

  console.log("[5] Polling Tier2...");
  let tier2Data = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await apiGet("/api/tier2/status?tier2Id=" + tier2ReportId, t);
    if (i % 5 === 0) console.log("    poll " + (i+1) + ": " + st.generationStatus);
    if (st.generationStatus === "ready") { tier2Data = st.content; console.log("    READY!"); break; }
    if (st.generationStatus === "failed") { console.error("FAIL"); process.exit(1); }
  }
  if (!tier2Data) { console.error("TIMEOUT"); process.exit(1); }

  console.log("\n[6] Product enrichment:");
  const pr = tier2Data.productRecs || {};
  const dims = Object.keys(pr);
  let enriched = 0, total = 0;
  for (const dim of dims) {
    const items = pr[dim] || [];
    for (const item of items) {
      total++;
      const hi = !!(item.imageUrl && item.imageUrl.length > 10);
      const hl = !!(item.itemUrl && item.itemUrl.length > 10);
      const hp = item.price != null && item.price > 0;
      if (hi && hl && hp) enriched++;
      console.log("  [" + dim + "] " + item.name + " img=" + hi + " link=" + hl + " price=" + hp);
      if (hi) console.log("    img: " + item.imageUrl.substring(0, 80));
      if (hl) console.log("    link: " + item.itemUrl.substring(0, 80));
      if (hp) console.log("    price: " + item.price);
    }
  }
  console.log("\n  Result: " + enriched + "/" + total + " fully enriched");

  fs.writeFileSync(path.join(OUT, "e2e_81eba90d_final.json"), JSON.stringify({ summary: dims.flatMap(d => (pr[d]||[]).map(i => ({dim:d,name:i.name,hasImg:!!i.imageUrl,hasLink:!!i.itemUrl,hasPrice:i.price!=null,imageUrl:i.imageUrl,itemUrl:i.itemUrl,price:i.price}))), tier2Data }, null, 2));
  console.log("  Data saved.");

  console.log("\n[7] Browser test...");
  const browser = await chromium.launch({ headless: true });
  const pg = await browser.newPage();
  await pg.addInitScript(({ tok }) => { localStorage.setItem("session_token", tok); }, { tok: t });
  await pg.goto("https://" + PROD_HOST + "/tier2-result?reportId=" + tier2ReportId, { waitUntil: "networkidle" });
  await pg.waitForTimeout(3000);
  await pg.screenshot({ path: path.join(OUT, "e2e_tier2_page.png"), fullPage: false });
  console.log("  URL: " + pg.url());
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count();
  console.log("  Lightbulbs: " + bulbCount);
  if (bulbCount > 0) {
    await pg.locator(".t2-lightbulb-btn").first().click();
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: path.join(OUT, "e2e_modal_dim0.png"), fullPage: false });
    const modalCheck = await pg.evaluate(() => {
      const inner = document.querySelector(".t2-modal-overlay-inner");
      if (!inner) return { error: "no inner" };
      const cards = inner.querySelectorAll(".t2-product-card");
      const imgs = inner.querySelectorAll("img");
      const links = inner.querySelectorAll(".t2-product-link-text");
      const names = Array.from(inner.querySelectorAll(".t2-product-name")).map(el => el.textContent.trim().substring(0, 25));
      return { cardCount: cards.length, imgCount: imgs.length, linkCount: links.length, names, imgSrcs: Array.from(imgs).map(el => el.src.substring(0, 80)), linkTexts: Array.from(links).map(el => el.textContent.trim().substring(0, 50)) };
    });
    console.log("  Modal: " + JSON.stringify(modalCheck));
  }
  await browser.close();
  console.log("\n========================================");
  console.log("  E2E COMPLETE!");
  console.log("========================================");
})().catch(e => { console.error("FATAL:", e.message); console.error(e.stack); process.exit(1); });
