const { chromium } = require("playwright");
const https = require("https");
const fs2 = require("fs");
const path = require("path");
const PROD = "https://e9fcd454.beauty-api-pages.pages.dev";
const OUT = path.join(process.cwd(), "test_output");
if (!fs2.existsSync(OUT)) fs2.mkdirSync(OUT, { recursive: true });
const NEW_PHONE = "13" + String(Date.now()).slice(-9);
const NEW_PASSWORD = "TestPic" + String(Date.now()).slice(-4);

function apiPost(p, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: "e9fcd454.beauty-api-pages.pages.dev", path: p, method: "POST", headers: hdrs }, x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); });
    r.on("error", rej);
    r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
    r.write(JSON.stringify(body));
    r.end();
  });
}
function apiGet(p, token) {
  return new Promise((res, rej) => {
    const hdrs = {};
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: "e9fcd454.beauty-api-pages.pages.dev", path: p, method: "GET", headers: hdrs }, x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); });
    r.on("error", rej);
    r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end();
  });
}

function apiMultipartPost(p, fieldName, filePath, token) {
  return new Promise((res, rej) => {
    const bnd = "----E2EBoundary" + Date.now();
    const buf = fs2.readFileSync(filePath);
    const part1 = "--" + bnd + "\r\nContent-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
    const part2 = "\r\n--" + bnd + "--\r\n";
    const body = Buffer.concat([Buffer.from(part1, "utf8"), buf, Buffer.from(part2, "utf8")]);
    const hdrs = { "Content-Type": "multipart/form-data; boundary=" + bnd };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: "e9fcd454.beauty-api-pages.pages.dev", path: p, method: "POST", headers: hdrs }, x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); });
    r.on("error", rej);
    r.setTimeout(60000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end(body);
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  const snaps = [];
  async function snap(n) {
    const s = path.join(OUT, n + ".png");
    await pg.screenshot({ path: s, fullPage: false });
    snaps.push(s);
    console.log("[SNAP] " + n);
  }
  console.log("\n========================================");
  console.log("  PRODUCTION E2E: New account -> Tier1 -> Tier2 -> Product check");
  console.log("  Phone: " + NEW_PHONE);
  console.log("========================================\n");

  console.log("[1] Registering new account...");
  const regRes = await apiPost("/api/auth/register", { account: NEW_PHONE, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
  console.log("    " + JSON.stringify(regRes).substring(0, 300));
  const regToken = regRes.sessionId || regRes.token;
  if (!regToken) { console.error("FAIL: no session"); process.exit(1); }
  console.log("    Session: " + regToken.substring(0, 12) + "...");

  console.log("\n[2] Setting password...");
  const setPasswordRes = await apiPost("/api/auth/set-password", { password: NEW_PASSWORD }, regToken);
  console.log("    " + JSON.stringify(setPasswordRes).substring(0, 200));

  console.log("\n[3] Logging in with password...");
  const loginRes = await apiPost("/api/auth/phone/login-password", { phone: NEW_PHONE, password: NEW_PASSWORD });
  console.log("    " + JSON.stringify(loginRes).substring(0, 300));
  const token = loginRes.sessionId || loginRes.token;
  if (!token) { console.error("FAIL: no token"); process.exit(1); }
  console.log("    Token: " + token.substring(0, 12) + "...");
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: token });

  console.log("\n[4] Uploading photo for Tier1 analysis...");
  const PHOTO_PATH = path.join(process.cwd(), "photo.jpg");
  const t1Res = await apiMultipartPost("/api/tier1/analyze", "photo", PHOTO_PATH, token);
  console.log("    reportId: " + t1Res.reportId);
  console.log("    preview: " + JSON.stringify(t1Res).substring(0, 500));
  if (!t1Res.reportId) { console.error("FAIL: no reportId"); process.exit(1); }
  const tier1ReportId = t1Res.reportId;

  console.log("\n[5] Triggering share unlock (calls enrichProductRecs internally)...");
  const shareRes = await apiPost("/api/tier1/share", { reportId: tier1ReportId }, token);
  console.log("    " + JSON.stringify(shareRes).substring(0, 400));
  const tier2ReportId = shareRes.tier2ReportId;
  if (!tier2ReportId) { console.error("FAIL: no tier2ReportId"); process.exit(1); }
  console.log("    tier2ReportId: " + tier2ReportId);

  console.log("\n[6] Polling Tier2 generation...");
  let tier2Data = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await apiGet("/api/tier2/status?tier2Id=" + tier2ReportId, token);
    console.log("    poll " + (i+1) + ": " + st.generationStatus);
    if (st.generationStatus === "ready") { tier2Data = st.content; console.log("    READY!"); break; }
    if (st.generationStatus === "failed") { console.error("FAIL: generation failed"); process.exit(1); }
  }
  if (!tier2Data) { console.error("FAIL: timeout"); process.exit(1); }

  console.log("\n[7] Checking product enrichment (images + Taobao links)...");
  const pr = tier2Data.productRecs || {};
  const dims = Object.keys(pr);
  console.log("    Dimensions: " + dims.join(", "));
  let allOk = true;
  const summary = [];
  for (const dim of dims) {
    for (const item of (pr[dim] || [])) {
      const hasImg = !!(item.imageUrl && item.imageUrl.length > 10);
      const hasLink = !!(item.itemUrl && item.itemUrl.length > 10);
      const hasPrice = item.price != null && item.price > 0;
      const ok = hasImg && hasLink;
      if (!ok) allOk = false;
      console.log("    [" + dim + "] " + item.name);
      console.log("      image: " + (hasImg ? "OK " + item.imageUrl.substring(0,70) : "MISSING"));
      console.log("      link:  " + (hasLink ? "OK " + item.itemUrl.substring(0,70) : "MISSING"));
      console.log("      price: " + (hasPrice ? "OK " + item.price : "MISSING"));
      summary.push({ dim, name: item.name, hasImg, hasLink, hasPrice, imageUrl: item.imageUrl, itemUrl: item.itemUrl, price: item.price });
    }
  }
  console.log("\n    " + (allOk ? "ALL VERIFIED OK" : "SOME MISSING DATA"));
  const dataFile = path.join(OUT, "e2e_product_data.json");
  fs2.writeFileSync(dataFile, JSON.stringify({ summary, tier2Data }, null, 2));
  console.log("    Data saved: " + dataFile);

  console.log("\n[8] Browser screenshots...");
  await pg.goto(PROD + "/home", { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(1500);
  await snap("e2e_home");
  await pg.goto(PROD + "/tier2-result?reportId=" + tier2ReportId, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(4000);
  await snap("e2e_tier2_page");
  console.log("    URL: " + pg.url());
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count();
  console.log("    Lightbulbs: " + bulbCount);
  if (bulbCount > 0) {
    await pg.locator(".t2-lightbulb-btn").first().click();
    await pg.waitForTimeout(1500);
    await snap("e2e_modal_dim0");
    const modalCheck = await pg.evaluate(() => {
      const inner = document.querySelector(".t2-modal-overlay-inner");
      if (!inner) return { error: "no inner" };
      const cards = inner.querySelectorAll(".t2-product-card");
      const imgs = inner.querySelectorAll("img");
      const links = inner.querySelectorAll(".t2-product-link-text");
      const names = Array.from(inner.querySelectorAll(".t2-product-name")).map(el => el.textContent.trim().substring(0, 25));
      return { cardCount: cards.length, imgCount: imgs.length, linkCount: links.length, names, imgSrcs: Array.from(imgs).map(el => el.src.substring(0, 80)), linkTexts: Array.from(links).map(el => el.textContent.trim().substring(0, 50)) };
    });
    console.log("    Modal check: " + JSON.stringify(modalCheck));
    await snap("e2e_modal_detail");
    for (let i = 1; i < Math.min(bulbCount, 4); i++) {
      try { await pg.locator(".t2-modal-close").first().click(); await pg.waitForTimeout(500); } catch(e) {}
      try { await pg.locator(".t2-lightbulb-btn").nth(i).click(); await pg.waitForTimeout(1000); } catch(e) {}
      await snap("e2e_modal_dim" + i);
    }
  }
  await browser.close();
  console.log("\n========================================");
  console.log("  E2E COMPLETE! Screenshots: " + snaps.length);
  snaps.forEach(s => console.log("   " + s));
  console.log("   Data: " + dataFile);
  console.log("========================================");
})().catch(e => { console.error("FATAL:", e.message); console.error(e.stack); process.exit(1); });
