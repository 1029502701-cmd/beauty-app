/**
 * 完整生产环境端到端测试
 * 流程: 注册新用户 -> Tier1拍照分析 -> 广告解锁Tier2 -> 等待生成 -> 浏览器验证弹商品卡片
 * 注意：不走捷径，直接调真实API，真实触发 enrichProductRecs
 */
const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PROD = "https://e9fcd454.beauty-api-pages.pages.dev";
const OUT = path.join(process.cwd(), "test_output");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const NEW_PHONE = "1" + String(Date.now()).slice(-10);
const NEW_PASSWORD = "PicTest" + String(Date.now()).slice(-4);
const PHOTO_PATH = path.join(process.cwd(), "photo.jpg");

function apiPost(p, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request(
      { hostname: "e9fcd454.beauty-api-pages.pages.dev", path: p, method: "POST", headers: hdrs },
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
    const r = https.request(
      { hostname: "e9fcd454.beauty-api-pages.pages.dev", path: p, method: "GET", headers: hdrs },
      x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); }
    );
    r.on("error", rej);
    r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end();
  });
}
function apiAdminPost(p, body, adminToken) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (adminToken) hdrs["Authorization"] = "Bearer " + adminToken;
    const r = https.request(
      { hostname: "e9fcd454.beauty-api-pages.pages.dev", path: p, method: "POST", headers: hdrs },
      x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); }
    );
    r.on("error", rej);
    r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
    r.write(JSON.stringify(body));
    r.end();
  });
}
function apiAdminLogin() {
  return new Promise((res, rej) => {
    const data = JSON.stringify({ username: "15961962243", password: "123456bn" });
    const r = https.request(
      { hostname: "e9fcd454.beauty-api-pages.pages.dev", path: "/api/admin/login", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } },
      x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } }); }
    );
    r.on("error", rej);
    r.setTimeout(15000, () => { r.destroy(); rej(new Error("timeout")); });
    r.write(data);
    r.end();
  });
}
function apiMultipartPost(p, fieldName, filePath, token) {
  return new Promise((res, rej) => {
    const bnd = "----E2EAdUnlockBoundary" + Date.now();
    const buf = fs.readFileSync(filePath);
    const part1 = "--" + bnd + "\r\nContent-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
    const part2 = "\r\n--" + bnd + "--\r\n";
    const body = Buffer.concat([Buffer.from(part1, "utf8"), buf, Buffer.from(part2, "utf8")]);
    const hdrs = { "Content-Type": "multipart/form-data; boundary=" + bnd };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request(
      { hostname: "e9fcd454.beauty-api-pages.pages.dev", path: p, method: "POST", headers: hdrs },
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
  return s;
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pg = await ctx.newPage();
  const snaps = [];

  console.log("\n" + "=".repeat(60));
  console.log("  生产环境端到端测试：注册 -> Tier1 -> 广告解锁Tier2 -> 商品卡片验证");
  console.log("  账号: " + NEW_PHONE);
  console.log("  域名: " + PROD);
  console.log("=".repeat(60) + "\n");

  // Step 1: 管理员登录
  console.log("[1/7] 管理员登录，同步配置...");
  const adminRes = await apiAdminLogin();
  const adminToken = adminRes.sessionId;
  if (!adminToken) { console.error("  FAIL: 管理员登录失败", JSON.stringify(adminRes)); await browser.close(); process.exit(1); }
  console.log("  Admin OK, token: " + adminToken.substring(0, 8) + "...");

  for (const cfg of [
    { key: "tier2_show_ai_image", value: "true" },
    { key: "tier2_btn_color", value: "#000000" },
    { key: "tier2_hook_text", value: "解锁专属报告，搭配更多场景" },
  ]) {
    const r = await apiAdminPost("/api/admin/config", cfg, adminToken);
    console.log("  config " + cfg.key + "=" + cfg.value + ":", r.success ? "OK" : JSON.stringify(r).substring(0, 100));
  }

  // Step 2: 注册新用户
  console.log("\n[2/7] 注册新用户...");
  const regRes = await apiPost("/api/auth/register", {
    account: NEW_PHONE, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD
  });
  const regToken = regRes.sessionId || regRes.token;
  if (!regToken) { console.error("  FAIL: 注册失败", JSON.stringify(regRes)); await browser.close(); process.exit(1); }
  console.log("  注册成功, session: " + regToken.substring(0, 12) + "...");

  // Step 3: Tier1 拍照分析
  console.log("\n[3/7] Tier1 拍照分析...");
  if (!fs.existsSync(PHOTO_PATH)) { console.error("  FAIL: 照片不存在:", PHOTO_PATH); await browser.close(); process.exit(1); }
  const t1Res = await apiMultipartPost("/api/tier1/analyze", "photo", PHOTO_PATH, regToken);
  if (!t1Res.reportId) { console.error("  FAIL: 无 reportId", JSON.stringify(t1Res)); await browser.close(); process.exit(1); }
  const tier1ReportId = t1Res.reportId;
  console.log("  Tier1 完成, reportId: " + tier1ReportId);
  console.log("  面部特征: faceShape=" + t1Res.faceShape + ", skinType=" + t1Res.skinType + ", eyeShape=" + t1Res.eyeShape);

  // Step 4: 广告解锁 Tier2 (真实触发 enrichProductRecs)
  console.log("\n[4/7] 广告解锁 Tier2 (调用 /api/tier2/unlock-by-ad)...");
  const unlockRes = await apiPost("/api/tier2/unlock-by-ad", { tier1ReportId }, regToken);
  if (!unlockRes.tier2ReportId) {
    console.error("  FAIL: 解锁失败", JSON.stringify(unlockRes));
    await browser.close(); process.exit(1);
  }
  const tier2ReportId = unlockRes.tier2ReportId;
  console.log("  解锁成功, tier2ReportId: " + tier2ReportId);

  // Step 5: 轮询等待 Tier2 生成完成
  console.log("\n[5/7] 轮询 Tier2 生成状态 (等待 enrichProductRecs 完成)...");
  let tier2Data = null;
  let generationStatus = null;
  for (let i = 0; i < 80; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await apiGet("/api/tier2/status?tier2Id=" + tier2ReportId, regToken);
    generationStatus = st.generationStatus;
    console.log("  poll " + (i + 1) + "/80: status=" + generationStatus);
    if (st.generationStatus === "ready") { tier2Data = st.content; console.log("  READY!"); break; }
    if (st.generationStatus === "failed") { console.error("  FAIL: generation failed!"); await browser.close(); process.exit(1); }
  }
  if (!tier2Data) { console.error("  FAIL: timeout"); await browser.close(); process.exit(1); }

  // Step 6: API 层验证产品数据
  console.log("\n[6/7] API 层验证产品数据完整性...");
  const pr = tier2Data.productRecs || {};
  const dimOrder = ["faceShape", "skinType", "eyebrowShape", "eyeShape", "threeFiveRatio", "symmetry"];
  const allResults = [];
  let apiAllOk = true;

  for (const dim of dimOrder) {
    const items = pr[dim] || [];
    if (items.length === 0) continue;
    for (const item of items) {
      const hasImg = !!(item.imageUrl && item.imageUrl.length > 20);
      const hasLink = !!(item.itemUrl && item.itemUrl.length > 20);
      const hasPrice = typeof item.price === "number" && item.price > 0;
      const hasCurated = !!(item.curatedProduct && item.curatedProduct.itemUrl);
      const ok = hasImg && hasLink;
      if (!ok) apiAllOk = false;
      console.log("  [" + dim + "] " + item.name);
      console.log("    image: " + (hasImg ? "OK " + item.imageUrl.substring(0, 60) : "MISSING"));
      console.log("    link:  " + (hasLink ? "OK " + item.itemUrl.substring(0, 60) : "MISSING"));
      console.log("    price: " + (hasPrice ? "OK " + item.price : "MISSING"));
      console.log("    curated:" + (hasCurated ? "OK " + item.curatedProduct.name : "-"));
      allResults.push({ dim, name: item.name, hasImg, hasLink, hasPrice, hasCurated });
    }
  }

  const totalItems = allResults.length;
  const imgOkCount = allResults.filter(r => r.hasImg).length;
  const linkOkCount = allResults.filter(r => r.hasLink).length;
  console.log("\n  API汇总: " + totalItems + " 个商品 | 有图: " + imgOkCount + "/" + totalItems + " | 有链接: " + linkOkCount + "/" + totalItems);
  console.log("  " + (apiAllOk ? "  API层全部通过" : "  API层部分缺失"));

  const dataFile = path.join(OUT, "e2e_ad_unlock_product_data.json");
  fs.writeFileSync(dataFile, JSON.stringify({ results: allResults, tier2Data }, null, 2));
  console.log("  数据已保存: " + dataFile);

  // Step 7: 浏览器验证弹商品卡片
  console.log("\n[7/7] 浏览器验证弹商品卡片渲染...");
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: regToken });

  await pg.goto(PROD + "/tier2-result?reportId=" + tier2ReportId, { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(5000);
  await snap(pg, "e2e_ad_unlock_tier2_page", snaps);
  console.log("  URL: " + pg.url());

  const bulbCount = await pg.locator(".t2-lightbulb-btn").count().catch(() => 0);
  console.log("  灯泡按钮数: " + bulbCount);

  const modalScreenshots = [];
  for (let i = 0; i < Math.min(bulbCount, 6); i++) {
    try {
      await pg.locator(".t2-lightbulb-btn").nth(i).click();
      await pg.waitForTimeout(1500);
      const snapName = "e2e_ad_unlock_modal_dim" + i;
      await snap(pg, snapName, snaps);

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

      console.log("  弹窗[" + i + "] 验证: " + JSON.stringify(modalCheck));
      modalScreenshots.push({ index: i, check: modalCheck, snap: path.join(OUT, snapName + ".png") });

      try { await pg.locator(".t2-modal-close").click(); await pg.waitForTimeout(800); } catch (e) {}
    } catch (e) {
      console.log("  弹窗[" + i + "] 出错: " + e.message);
    }
  }

  // 最终汇总
  console.log("\n" + "=".repeat(60));
  console.log("  端到端测试结果汇总");
  console.log("=".repeat(60));
  console.log("  账号: " + NEW_PHONE);
  console.log("  Tier1 reportId: " + tier1ReportId);
  console.log("  Tier2 reportId: " + tier2ReportId);
  console.log("  Tier2 生成状态: " + generationStatus);
  console.log("  API商品总数: " + totalItems);
  console.log("  有真实图片: " + imgOkCount + "/" + totalItems);
  console.log("  有淘宝链接: " + linkOkCount + "/" + totalItems);
  console.log("  API层验证: " + (apiAllOk ? "全部通过" : "部分缺失"));
  console.log("  浏览器截图数: " + snaps.length);
  console.log("  数据文件: " + dataFile);

  let modalOk = true;
  for (const ms of modalScreenshots) {
    if (ms.check.cardCount > 0) {
      console.log("  弹窗[" + ms.index + "] 卡片=" + ms.check.cardCount + " 图片=" + ms.check.imgCount + " 链接=" + ms.check.linkCount + (ms.check.anyImgVisible ? " OK" : " WAIT"));
    } else {
      modalOk = false;
      console.log("  弹窗[" + ms.index + "] 无卡片: " + JSON.stringify(ms.check));
    }
  }
  console.log("  弹窗验证: " + (modalOk ? "通过" : "异常"));
  console.log("=".repeat(60));

  await browser.close();
  process.exit(0);
})().catch(e => {
  console.error("FATAL ERROR:", e.message);
  console.error(e.stack);
  process.exit(1);
});
