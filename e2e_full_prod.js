const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PROD = "https://ccfu.ccwu.cc";
const OUT = path.join(process.cwd(), "test_output");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const NEW_PHONE = "1" + String(Date.now()).slice(-10);
const PHOTO_PATH = path.join(process.cwd(), "photo.jpg");

function apiPost(p, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: "ccfu.ccwu.cc", path: p, method: "POST", headers: hdrs },
      x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res({ raw: d.substring(0, 200) }); } }); }
    );
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
    const r = https.request({ hostname: "ccfu.ccwu.cc", path: p, method: "GET", headers: hdrs },
      x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); }
    );
    r.on("error", rej);
    r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
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
    const r = https.request({ hostname: "ccfu.ccwu.cc", path: p, method: "POST", headers: hdrs },
      x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); }
    );
    r.on("error", rej);
    r.setTimeout(60000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end(body);
  });
}

async function snap(pg, name, snaps) {
  const s = path.join(OUT, name + ".png");
  await pg.screenshot({ path: s, fullPage: false });
  snaps.push(s);
  console.log("  [SNAP] " + name);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pg = await ctx.newPage();
  const snaps = [];

  console.log("E2E 新账号: " + NEW_PHONE);
  console.log("照片: " + fs.statSync(PHOTO_PATH).size + " bytes");

  console.log("[1/6] 注册...");
  const reg = await apiPost("/api/auth/register", { account: NEW_PHONE, password: "PicTest1", confirmPassword: "PicTest1" });
  const regToken = reg.sessionId;
  console.log("  Token: " + (regToken ? regToken.substring(0, 12) : "FAIL"));
  if (!regToken) { console.error("注册失败:", JSON.stringify(reg)); await browser.close(); process.exit(1); }

  console.log("[2/6] Tier1 实拍分析(multipart)...");
  const t1 = await apiMultipartPost("/api/tier1/analyze", "photo", PHOTO_PATH, regToken);
  const tier1Id = t1.reportId;
  console.log("  Tier1 ID: " + tier1Id);
  if (!tier1Id) { console.error("Tier1失败:", JSON.stringify(t1).substring(0, 300)); await browser.close(); process.exit(1); }
  if (t1.report) { const r = t1.report; console.log("  face=" + r.faceShape + " skin=" + r.skinType + " eye=" + r.eyeShape); }

  console.log("[3/6] 广告解锁Tier2...");
  const unlock = await apiPost("/api/tier2/unlock-by-ad", { tier1ReportId: tier1Id }, regToken);
  const tier2Id = unlock.tier2ReportId;
  console.log("  Tier2 ID: " + tier2Id);
  if (!tier2Id) { console.error("解锁失败:", JSON.stringify(unlock)); await browser.close(); process.exit(1); }

  console.log("[4/6] 触发Tier2生成...");
  const gen = await apiPost("/api/tier2/generate", { reportId: tier2Id }, regToken);
  console.log("  初始状态: " + gen.generationStatus);

  let tier2Content = null;
  for (let i = 0; i < 45; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const status = await apiGet("/api/tier2/status?tier2Id=" + tier2Id, regToken);
    if (status.generationStatus === "ready" && status.content) {
      tier2Content = status.content;
      console.log("  完成! keys: " + Object.keys(status.content.productRecs || {}).join(","));
      break;
    }
    if (status.generationStatus === "failed") { console.error("生成失败!"); await browser.close(); process.exit(1); }
    if (i % 8 === 7) console.log("  等待... " + (i + 1));
  }
  if (!tier2Content) { console.error("超时"); await browser.close(); process.exit(1); }

  console.log("[5/6] API产品验证...");
  const pr = tier2Content.productRecs || {};
  const allResults = [];
  let total = 0, withImg = 0, withLink = 0;
  for (const [dim, items] of Object.entries(pr)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      total++;
      const hasImg = !!(item.imageUrl && item.imageUrl.startsWith("http"));
      const hasLink = !!(item.itemUrl && item.itemUrl.startsWith("http"));
      if (hasImg) withImg++;
      if (hasLink) withLink++;
      allResults.push({ dim, name: item.name, hasImg, hasLink });
      console.log("  [" + dim + "] " + item.name + " img=" + hasImg + " link=" + hasLink);
    }
  }
  console.log("  汇总: " + total + " 商品 | 有图:" + withImg + "/" + total + " | 有链接:" + withLink + "/" + total);

  console.log("[6/6] 浏览器弹窗验证...");
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: regToken });
  await pg.goto(PROD + "/tier2-result?reportId=" + tier2Id, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);
  await snap(pg, "e2e_new_tier2_page", snaps);

  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  灯泡: " + bulbCount);

  const modalResults = [];
  for (let i = 0; i < Math.min(bulbCount, 6); i++) {
    try {
      await pg.locator(".t2-lightbulb-btn").nth(i).click();
      await pg.waitForTimeout(1500);
      await snap(pg, "e2e_new_modal_" + i, snaps);
      const check = await pg.evaluate(() => {
        const inner = document.querySelector(".t2-modal-overlay-inner");
        if (!inner) return { error: "no modal" };
        const cards = inner.querySelectorAll(".t2-product-card");
        const imgs = inner.querySelectorAll("img");
        const linkTexts = inner.querySelectorAll(".t2-product-link-text");
        return { cardCount: cards.length, imgCount: imgs.length, linkCount: linkTexts.length,
          anyImgVisible: imgs.length > 0 && Array.from(imgs).some(el => el.naturalWidth > 0),
          imgSrcs: Array.from(imgs).slice(0, 2).map(el => (el.src || "").substring(0, 80)) };
      });
      console.log("  弹窗[" + i + "] cards=" + check.cardCount + " imgs=" + check.imgCount + " links=" + check.linkCount + " imgVis=" + check.anyImgVisible);
      modalResults.push({ index: i, ...check });
      try { await pg.locator(".t2-modal-close").click(); await pg.waitForTimeout(800); } catch (e) {}
    } catch (e) { console.log("  弹窗[" + i + "] 错误: " + e.message); }
  }

  await snap(pg, "e2e_new_final", snaps);

  const apiOk = withImg > 0 && withLink > 0;
  const modalOk = modalResults.every(m => m.cardCount > 0 && m.anyImgVisible);
  console.log("\n结果: Tier1=" + tier1Id + " Tier2=" + tier2Id);
  console.log("API层: " + total + " 商品 | 有图:" + withImg + "/" + total + " | 有链接:" + withLink + "/" + total + " => " + (apiOk ? "PASS" : "FAIL"));
  console.log("弹窗: " + (modalOk ? "PASS" : "FAIL"));
  console.log("截图: " + snaps.length + " 张");

  fs.writeFileSync(path.join(OUT, "e2e_new_token.txt"), regToken);
  fs.writeFileSync(path.join(OUT, "e2e_new_tier2.txt"), tier2Id);
  fs.writeFileSync(path.join(OUT, "e2e_new_report.json"), JSON.stringify({ tier1Id, tier2Id, results: allResults, modals: modalResults }, null, 2));

  await browser.close();
  process.exit(0);
})().catch(e => { console.error("FATAL:", e.message); console.error(e.stack); process.exit(1); });