const https = require('https');
const fs = require('fs');
const path = require('path');
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
    const part1 = "--" + bnd + "\r\nContent-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
    const part2 = "\r\n--" + bnd + "--\r\n";
    const body = Buffer.concat([Buffer.from(part1, "utf8"), buf, Buffer.from(part2, "utf8")]);
    const hdrs = { "Content-Type": "multipart/form-data; boundary=" + bnd };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: PROD_HOST, path: p, method: "POST", headers: hdrs }, x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); });
    r.on("error", rej); r.setTimeout(60000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end(body);
  });
}
(async () => {
  console.log("Phone:", NEW_PHONE);
  const regRes = await apiPost("/api/auth/register", { account: NEW_PHONE, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
  console.log("[1] Register:", JSON.stringify(regRes).substring(0, 200));
  const t = (regRes.sessionId || regRes.token);

  const loginRes = await apiPost("/api/auth/phone/login-password", { phone: NEW_PHONE, password: NEW_PASSWORD });
  console.log("[2] Login:", JSON.stringify(loginRes).substring(0, 200));
  const token = loginRes.sessionId || loginRes.token;

  const t1Res = await apiMultipartPost("/api/tier1/analyze", "photo", PHOTO_PATH, token);
  console.log("[3] Tier1:", typeof t1Res === "string" ? t1Res.substring(0, 300) : JSON.stringify(t1Res).substring(0, 300));
  if (typeof t1Res === "string" && !t1Res.startsWith("{")) {
    console.error("FAIL: non-JSON response");
    process.exit(1);
  }
  const tier1ReportId = t1Res.reportId;

  const shareRes = await apiPost("/api/tier1/share", { reportId: tier1ReportId }, token);
  console.log("[4] Share:", JSON.stringify(shareRes).substring(0, 300));
  const tier2ReportId = shareRes.tier2ReportId;

  console.log("[5] Polling Tier2...");
  let tier2Data = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await apiGet("/api/tier2/status?tier2Id=" + tier2ReportId, token);
    if (i % 5 === 0) console.log("    poll " + (i+1) + ": " + st.generationStatus);
    if (st.generationStatus === "ready") { tier2Data = st.content; console.log("    READY!"); break; }
    if (st.generationStatus === "failed") { console.error("FAIL"); process.exit(1); }
  }
  if (!tier2Data) { console.error("TIMEOUT"); process.exit(1); }

  console.log("\n[6] Product enrichment:");
  const pr = tier2Data.productRecs || {};
  const dims = Object.keys(pr);
  let enriched = 0, total = 0;
  const summary = [];
  for (const dim of dims) {
    const items = pr[dim] || [];
    for (const item of items) {
      total++;
      const hasImg = !!(item.imageUrl && item.imageUrl.length > 10);
      const hasLink = !!(item.itemUrl && item.itemUrl.length > 10);
      const hasPrice = item.price != null && item.price > 0;
      if (hasImg && hasLink && hasPrice) enriched++;
      console.log("  [" + dim + "] " + item.name + " img=" + hasImg + " link=" + hasLink + " price=" + hasPrice);
      if (hasImg) console.log("    img: " + item.imageUrl.substring(0, 80));
      if (hasLink) console.log("    link: " + item.itemUrl.substring(0, 80));
      if (hasPrice) console.log("    price: " + item.price);
      summary.push({ dim: dim, name: item.name, hasImg: hasImg, hasLink: hasLink, hasPrice: hasPrice, imageUrl: item.imageUrl, itemUrl: item.itemUrl, price: item.price });
    }
  }
  console.log("\nResult: " + enriched + "/" + total + " enriched");
  fs.writeFileSync(path.join(OUT, "e2e_81eba90d_final.json"), JSON.stringify({ summary: summary, tier2Data: tier2Data }, null, 2));
  console.log("Saved: " + path.join(OUT, "e2e_81eba90d_final.json"));
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
