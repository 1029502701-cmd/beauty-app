const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const OUT = "C:/Users/yao/Documents/ChatGPT/美妆app/test_output";
const HOST = "44b4f35d.beauty-api-pages.pages.dev";

function apiPost(path, body, authToken) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) };
    if (authToken) headers["Authorization"] = "Bearer " + authToken;
    const req = https.request({ hostname: HOST, port: 443, path, method: "POST", headers },
      x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)) } catch (e) { res({ raw: d.substring(0, 100) }) } }); });
    req.on("error", rej); req.write(data); req.end();
  });
}
function apiGet(path, authToken) {
  return new Promise((res, rej) => {
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = "Bearer " + authToken;
    const req = https.request({ hostname: HOST, port: 443, path, method: "GET", headers },
      x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)) } catch (e) { res({ raw: d.substring(0, 100) }) } }); });
    req.on("error", rej); req.end();
  });
}

(async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pg = await ctx.newPage();

  // Step 1: Register
  console.log("[1] Register user...");
  const regRes = await apiPost("/api/auth/login-or-register", {
    account: "prodtest@verify.com", password: "Verify123", confirmPassword: "Verify123"
  });
  const token = regRes.sessionId;
  console.log("  Token:", token ? token.substring(0, 8) + "..." : "FAIL: " + JSON.stringify(regRes));
  if (!token) { await browser.close(); return; }
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: token });

  // Admin login
  console.log("[2] Admin login...");
  const adminRes = await apiPost("/api/admin/login", { username: "15961962243", password: "123456bn" });
  const adminToken = adminRes.sessionId;
  console.log("  Admin:", adminToken ? "OK" : "FAIL");

  // Sync configs
  console.log("[3] Syncing configs...");
  for (const u of [{ key: "tier2_btn_color", value: "#000000" }, { key: "tier2_show_ai_image", value: "true" }, { key: "tier2_hook_text", value: "解锁专属报告，搭配更多场景" }]) {
    const r = await apiPost("/api/admin/config", u, adminToken);
    console.log("  " + u.key + "=" + u.value + ":", r.success ? "OK" : JSON.stringify(r));
  }

  // Step 4: Upload photo via browser
  console.log("[4] Uploading photo...");
  await pg.goto("https://" + HOST + "/capture", { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(2000);
  try {
    await pg.locator('input[type="file"]').setInputFiles("C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg");
    console.log("  Photo uploaded");
  } catch (e) { console.log("  Upload error:", e.message.substring(0, 100)); }
  await pg.waitForTimeout(8000);

  let t1Id = await pg.evaluate(() => sessionStorage.getItem("capture_report_id"));
  console.log("  Tier1 ID:", t1Id || "NOT_SET");
  if (!t1Id) {
    // Try polling from API
    for (let i = 0; i < 10; i++) {
      await pg.waitForTimeout(5000);
      t1Id = await pg.evaluate(() => sessionStorage.getItem("capture_report_id"));
      if (t1Id) { console.log("  Tier1 ID found:", t1Id); break; }
      console.log("  [" + (i+1) + "] Still analyzing...");
    }
  }
  if (!t1Id) { console.log("[FAIL] No Tier1 report ID"); await browser.close(); return; }

  // Step 5: Trigger Tier2
  console.log("[5] Triggering Tier2 generation...");
  const shareRes = await apiPost("/api/tier1/share", { reportId: t1Id }, token);
  const t2Id = shareRes.tier2ReportId;
  console.log("  Tier2 ID:", t2Id ? t2Id.substring(0, 8) + "..." : JSON.stringify(shareRes));
  if (!t2Id) { await browser.close(); return; }

  // Poll for completion
  console.log("[6] Waiting for Tier2...");
  for (let i = 0; i < 40; i++) {
    await pg.waitForTimeout(5000);
    const status = await apiGet("/api/tier2/status?tier2Id=" + t2Id, token);
    console.log("  [" + (i+1) + "] " + (status.generationStatus || "pending"));
    if (status.generationStatus === "ready" || status.generationStatus === "failed") {
      console.log("  Done:", status.generationStatus);
      if (status.generationStatus === "failed") { console.log("  Error:", JSON.stringify(status).substring(0, 200)); break; }
      break;
    }
  }

  // Step 7: Navigate to Tier2 result
  console.log("[7] Navigating to Tier2 result...");
  await pg.goto("https://" + HOST + "/tier2-result?reportId=" + t2Id, { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(4000);

  // Checks
  const btnColor = await pg.evaluate(() => { const b = document.querySelector(".t2-btn-unlock"); return b ? getComputedStyle(b).backgroundColor : "NO_BTN"; });
  console.log("[8] Button color:", btnColor);

  const lightPos = await pg.evaluate(() => {
    const lb = document.querySelector(".t2-lightbulb-btn");
    if (!lb) return "NO_LIGHTBULB";
    const rect = lb.getBoundingClientRect();
    const card = lb.closest(".t2-dim-card");
    const cardRect = card.getBoundingClientRect();
    return { relTop: Math.round((rect.top - cardRect.top) / cardRect.height * 100), relRight: Math.round((cardRect.right - rect.right) / cardRect.width * 100), pos: getComputedStyle(lb).position };
  });
  console.log("[9] Lightbulb:", JSON.stringify(lightPos));

  const dimCheck = await pg.evaluate(() => {
    return Array.from(document.querySelectorAll(".t2-dim-card")).map((c, i) => ({
      i, hasPros: !!c.querySelector(".t2-dim-pros"), hasReason: !!c.querySelector(".t2-dim-reason"), hasTips: !!c.querySelector(".t2-dim-tips")
    }));
  });
  console.log("[10] Sections:", JSON.stringify(dimCheck));
  const allVisible = dimCheck.every(d => d.hasPros && d.hasReason && d.hasTips);
  console.log("    All visible:", allVisible ? "PASS" : "FAIL");

  await pg.screenshot({ path: OUT + "/P13_prod_full.png", fullPage: true });
  console.log("    Screenshot: P13_prod_full.png");

  // Modal test
  await pg.locator(".t2-lightbulb-btn").first().click();
  await pg.waitForTimeout(600);
  const modalInfo = await pg.evaluate(() => {
    const inner = document.querySelector(".t2-modal-overlay-inner");
    if (!inner) return null;
    return {
      productCount: inner.querySelectorAll(".t2-product-card").length,
      hasDimText: inner.querySelectorAll(".t2-dim-section").length > 0
    };
  });
  console.log("[11] Modal:", JSON.stringify(modalInfo));
  await pg.screenshot({ path: OUT + "/P14_prod_modal.png" });
  console.log("    Screenshot: P14_prod_modal.png");

  // Copy button
  const copyResult = await pg.evaluate(() => {
    const btn = document.querySelector(".t2-copy-btn");
    if (!btn) return { error: "no copy btn" };
    const linkEl = btn.closest(".t2-product-link-row")?.querySelector(".t2-product-link-text");
    const expectedLink = linkEl ? linkEl.textContent.trim() : null;
    let writeCalled = false, writeArg = null;
    const orig = navigator.clipboard?.writeText;
    if (orig) { navigator.clipboard.writeText = async (text) => { writeCalled = true; writeArg = text; return orig.call(navigator.clipboard, text); }; }
    btn.click();
    if (orig) navigator.clipboard.writeText = orig;
    return { hasBtn: true, link: expectedLink, writeCalled, writeArg: writeArg ? writeArg.substring(0, 50) : "(not called)" };
  });
  console.log("[12] Copy button:", JSON.stringify(copyResult));
  await pg.locator(".t2-modal-close").click();
  await pg.waitForTimeout(400);

  // Backend toggles
  console.log("[13] Backend toggles...");
  const saveCfg = async (key, value) => {
    const r = await apiPost("/api/admin/config", { key, value }, adminToken);
    console.log("  " + key + "=" + value + ":", r.success ? "OK" : JSON.stringify(r));
  };

  await saveCfg("tier2_show_ai_image", "false");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);
  console.log("  AI hidden:", await pg.evaluate(() => document.querySelector(".t2-card--hero") ? "VISIBLE" : "HIDDEN") ? "VISIBLE" : "HIDDEN");
  await pg.screenshot({ path: OUT + "/P15_prod_ai_off.png" });
  await saveCfg("tier2_show_ai_image", "true");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);

  await saveCfg("tier2_btn_color", "#FF0000");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);
  console.log("  Button red:", await pg.evaluate(() => getComputedStyle(document.querySelector(".t2-btn-unlock") || document.querySelector(".t2-share-btn")).backgroundColor));
  await pg.screenshot({ path: OUT + "/P16_prod_red.png" });
  await saveCfg("tier2_btn_color", "#000000");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);

  await saveCfg("tier2_hook_text", "【生产验证】解锁专属场景报告");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);
  console.log("  Hook text:", await pg.evaluate(() => (document.querySelector(".t2-tier3-hook-text") || {}).textContent.trim().substring(0, 30)));
  await pg.screenshot({ path: OUT + "/P17_prod_hook.png" });
  await saveCfg("tier2_hook_text", "解锁专属报告，搭配更多场景");

  await pg.screenshot({ path: OUT + "/P18_prod_final.png", fullPage: true });
  console.log("    Screenshot: P18_prod_final.png");

  await browser.close();
  console.log("\n=== Production verification COMPLETE ===");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
