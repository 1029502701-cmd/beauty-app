const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const OUT = "C:/Users/yao/Documents/ChatGPT/美妆app/test_output";
const T1_ID = "b63b905e-9f43-44d5-af9d-e19b7ca2b2ac";

function apiPost(path, body, authToken) {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) };
    if (authToken) headers["Authorization"] = "Bearer " + authToken;
    const req = https.request({
      hostname: "44b4f35d.beauty-api-pages.pages.dev", port: 443, path, method: "POST", headers
    }, x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)) } catch (e) { res(d) } }); });
    req.on("error", rej); req.write(data); req.end();
  });
}
function apiGet(path, authToken) {
  return new Promise((res, rej) => {
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = "Bearer " + authToken;
    const req = https.request({
      hostname: "44b4f35d.beauty-api-pages.pages.dev", port: 443, path, method: "GET", headers
    }, x => { let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)) } catch (e) { res(d) } }); });
    req.on("error", rej); req.end();
  });
}

(async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pg = await ctx.newPage();

  // Login
  const token = "4aa36bcc-5704-420d-8e3d-019cc7d05e55";
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: token });
  const adminRes = await apiPost("/api/admin/login", { username: "15961962243", password: "123456bn" });
  const adminToken = adminRes.sessionId;

  // Trigger Tier2 generation via share endpoint
  console.log("[1] Triggering Tier2 generation...");
  const shareRes = await apiPost("/api/tier1/share", { reportId: T1_ID }, token);
  console.log("  Tier2 ID:", shareRes.tier2ReportId ? shareRes.tier2ReportId.substring(0, 8) + "..." : JSON.stringify(shareRes));
  const t2Id = shareRes.tier2ReportId;
  if (!t2Id) { await browser.close(); return; }

  // Poll for completion
  console.log("[2] Polling for Tier2 completion...");
  for (let i = 0; i < 30; i++) {
    await pg.waitForTimeout(3000);
    const status = await apiGet("/api/tier2/status?tier2Id=" + t2Id, token);
    console.log("  [" + (i+1) + "] " + (status.generationStatus || "unknown"));
    if (status.generationStatus === "ready" || status.generationStatus === "failed") {
      console.log("  Final:", status.generationStatus);
      if (status.generationStatus === "failed") { console.log("  Error:", JSON.stringify(status).substring(0, 200)); break; }
      break;
    }
  }

  // Navigate to Tier2 result
  console.log("[3] Navigating to Tier2 result...");
  await pg.goto("https://44b4f35d.beauty-api-pages.pages.dev/tier2-result?reportId=" + t2Id, { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(4000);

  // Check 1: Button color
  const btnColor = await pg.evaluate(() => {
    const btn = document.querySelector(".t2-btn-unlock");
    return btn ? getComputedStyle(btn).backgroundColor : "NO_BTN";
  });
  console.log("[4] Button color:", btnColor);

  // Check 2: Lightbulb position
  const lightPos = await pg.evaluate(() => {
    const lb = document.querySelector(".t2-lightbulb-btn");
    if (!lb) return "NO_LIGHTBULB";
    const rect = lb.getBoundingClientRect();
    const card = lb.closest(".t2-dim-card");
    const cardRect = card.getBoundingClientRect();
    return { relTop: Math.round((rect.top - cardRect.top) / cardRect.height * 100), relRight: Math.round((cardRect.right - rect.right) / cardRect.width * 100), pos: getComputedStyle(lb).position };
  });
  console.log("[5] Lightbulb:", JSON.stringify(lightPos));

  // Check 3: Three sections visible
  const dimCheck = await pg.evaluate(() => {
    const cards = document.querySelectorAll(".t2-dim-card");
    return Array.from(cards).map((c, i) => ({
      i, hasPros: !!c.querySelector(".t2-dim-pros"), hasReason: !!c.querySelector(".t2-dim-reason"), hasTips: !!c.querySelector(".t2-dim-tips")
    }));
  });
  const allVisible = dimCheck.every(d => d.hasPros && d.hasReason && d.hasTips);
  console.log("[6] 3 sections visible:", allVisible ? "PASS" : "FAIL", JSON.stringify(dimCheck));

  // Full page screenshot
  await pg.screenshot({ path: OUT + "/P7_prod_full.png", fullPage: true });
  console.log("[7] Screenshot: P7_prod_full.png");

  // Check 4: Modal
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
  console.log("[8] Modal:", JSON.stringify(modalInfo));
  await pg.screenshot({ path: OUT + "/P8_prod_modal.png" });
  console.log("  Screenshot: P8_prod_modal.png");

  // Check 5: Copy button
  const copyResult = await pg.evaluate(() => {
    const btn = document.querySelector(".t2-copy-btn");
    if (!btn) return { error: "no copy btn" };
    const linkEl = btn.closest(".t2-product-link-row")?.querySelector(".t2-product-link-text");
    const expectedLink = linkEl ? linkEl.textContent.trim() : null;
    let writeCalled = false, writeArg = null;
    const orig = navigator.clipboard?.writeText;
    if (orig) {
      navigator.clipboard.writeText = async (text) => { writeCalled = true; writeArg = text; return orig.call(navigator.clipboard, text); };
    }
    btn.click();
    if (orig) navigator.clipboard.writeText = orig;
    return { hasBtn: true, link: expectedLink, writeCalled, writeArg: writeArg ? writeArg.substring(0, 50) : "(not called)" };
  });
  console.log("[9] Copy button:", JSON.stringify(copyResult));
  await pg.locator(".t2-modal-close").click();
  await pg.waitForTimeout(400);

  // Check 6: Backend toggles
  console.log("[10] Testing backend toggles...");

  const saveCfg = async (key, value) => {
    const r = await apiPost("/api/admin/config", { key, value }, adminToken);
    console.log("  " + key + "=" + value + ":", r.success ? "OK" : JSON.stringify(r));
    return r;
  };

  // 6a: Hide AI image
  await saveCfg("tier2_show_ai_image", "false");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);
  const aiHidden = await pg.evaluate(() => document.querySelector(".t2-card--hero") ? "VISIBLE" : "HIDDEN");
  console.log("  AI module:", aiHidden);
  await pg.screenshot({ path: OUT + "/P9_prod_ai_hidden.png" });
  await saveCfg("tier2_show_ai_image", "true");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);

  // 6b: Red button
  await saveCfg("tier2_btn_color", "#FF0000");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);
  const btnRed = await pg.evaluate(() => { const b = document.querySelector(".t2-btn-unlock"); return b ? getComputedStyle(b).backgroundColor : "NO_BTN"; });
  console.log("  Button red:", btnRed);
  await pg.screenshot({ path: OUT + "/P10_prod_red.png" });
  await saveCfg("tier2_btn_color", "#000000");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);

  // 6c: Hook text
  await saveCfg("tier2_hook_text", "【生产验证】解锁专属场景报告");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);
  const hookText = await pg.evaluate(() => { const e = document.querySelector(".t2-tier3-hook-text"); return e ? e.textContent.trim() : "NOT_FOUND"; });
  console.log("  Hook text:", hookText);
  await pg.screenshot({ path: OUT + "/P11_prod_hook.png" });
  await saveCfg("tier2_hook_text", "解锁专属报告，搭配更多场景");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(2000);

  // Final screenshot
  await pg.screenshot({ path: OUT + "/P12_prod_final.png", fullPage: true });
  console.log("[11] Screenshot: P12_prod_final.png");

  await browser.close();
  console.log("\n=== Production verification COMPLETE ===");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
