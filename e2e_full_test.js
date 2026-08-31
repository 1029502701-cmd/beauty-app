const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const APP_URL = "http://localhost:5174";
const API_URL = "http://127.0.0.1:8788";
const OUT = path.join(process.cwd(), "test_output");
const PHOTO = path.join(process.cwd(), "test_face.jpg");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const PHONE = "13" + String(Date.now()).slice(-9);
const PASSWORD = "TestPoll" + String(Date.now()).slice(-4);

function apiPost(p, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = http.request({ hostname: "127.0.0.1", port: 8788, path: p, method: "POST", headers: hdrs }, x => {
      let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    });
    r.on("error", rej); r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
    r.write(JSON.stringify(body)); r.end();
  });
}

function apiGet(p, token) {
  return new Promise((res, rej) => {
    const hdrs = {};
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = http.request({ hostname: "127.0.0.1", port: 8788, path: p, method: "GET", headers: hdrs }, x => {
      let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    });
    r.on("error", rej); r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end();
  });
}

function apiMultipartPost(p, fieldName, filePath, token) {
  return new Promise((res, rej) => {
    const bnd = "----PWBoundary" + Date.now();
    const buf = fs.readFileSync(filePath);
    const c1 = Buffer.from("--" + bnd + "\r\nContent-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n");
    const c2 = Buffer.from("\r\n--" + bnd + "--\r\n");
    const body = Buffer.concat([c1, buf, c2]);
    const hdrs = { "Content-Type": "multipart/form-data; boundary=" + bnd };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = http.request({ hostname: "127.0.0.1", port: 8788, path: p, method: "POST", headers: hdrs }, x => {
      let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    });
    r.on("error", rej); r.setTimeout(60000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end(body);
  });
}

(async () => {
  console.log("========================================");
  console.log("  PLAYWRIGHT E2E TEST - Tier2 Polling Fix");
  console.log("  App URL:", APP_URL);
  console.log("  API URL:", API_URL);
  console.log("  Phone:", PHONE);
  console.log("========================================\n");

  // ── PART 1: Register, login, upload photo ──
  console.log("[PART 1] Registration & Photo Upload");
  const regRes = await apiPost("/api/auth/register", { account: PHONE, password: PASSWORD, confirmPassword: PASSWORD });
  console.log("  Register:", JSON.stringify(regRes).substring(0, 150));
  const token = regRes.sessionId || regRes.token;

  const loginRes = await apiPost("/api/auth/phone/login-password", { phone: PHONE, password: PASSWORD });
  const t = loginRes.sessionId || loginRes.token;
  console.log("  Login token:", (t || "").substring(0, 40));

  const t1Res = await apiMultipartPost("/api/tier1/analyze", "photo", PHOTO, t);
  const reportId = t1Res.reportId;
  console.log("  Tier1 reportId:", reportId);

  // Trigger tier2 generation via share
  const shareRes = await apiPost("/api/tier1/share", { reportId }, t);
  const tier2ReportId = shareRes.tier2ReportId;
  console.log("  Tier2 reportId:", tier2ReportId);
  console.log("");

  // ── PART 2: Launch browser and navigate ──
  console.log("[PART 2] Browser Navigation");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript((tok) => {
    localStorage.setItem("session_token", tok);
  }, t);

  const reportUrl = APP_URL + "/report?id=" + encodeURIComponent(reportId);
  console.log("  Navigating to:", reportUrl);
  await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.screenshot({ path: path.join(OUT, "e2e_01_loaded.png"), fullPage: false });
  console.log("  [SCREENSHOT] e2e_01_loaded.png");

  // Wait for initial render
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "e2e_02_before_unlock.png"), fullPage: false });
  console.log("  [SCREENSHOT] e2e_02_before_unlock.png");

  // ── PART 3: Monitor tier2/status requests ──
  console.log("\n[PART 3] Monitoring tier2/status requests");
  const statusRequests = [];
  const allRequests = [];
  page.on("request", (req) => {
    const url = req.url();
    allRequests.push({ time: Date.now(), url: url, method: req.method() });
    if (url.includes("/tier2/status")) {
      statusRequests.push({ time: Date.now(), url: url });
      const ts = ((Date.now() - statusRequests[0].time) / 1000).toFixed(1);
      console.log("  >>> tier2/status #" + statusRequests.length + " @" + ts + "s -> " + url.substring(url.indexOf("/tier2")));
    }
  });

  // Also listen for responses to capture status
  const statusResponses = [];
  page.on("response", async (resp) => {
    const url = resp.url();
    if (url.includes("/tier2/status")) {
      try {
        const data = await resp.json();
        statusResponses.push({ time: Date.now(), status: data.generationStatus, hasContent: !!data.content });
        const ts = ((Date.now() - statusRequests[0].time) / 1000).toFixed(1);
        console.log("  <<< tier2/status response #" + statusResponses.length + " @" + ts + "s: " + data.generationStatus + (data.content ? " [HAS CONTENT]" : ""));
      } catch {}
    }
  });

  // ── PART 4: Click unlock button ──
  console.log("\n[PART 4] Clicking unlock button");
  await page.waitForTimeout(2000);
  
  const bodyText = await page.textContent("body");
  console.log("  Page text preview:", bodyText.substring(0, 400));

  const shareBtn = await page.$("button:has-text('分享解锁'), button:has-text('去分享解锁'), button:has-text('分享解锁进阶报告')");
  if (shareBtn) {
    console.log("  Found share unlock button, clicking...");
    await shareBtn.click();
    await page.screenshot({ path: path.join(OUT, "e2e_03_after_click.png"), fullPage: false });
    console.log("  [SCREENSHOT] e2e_03_after_click.png");
  } else {
    const adBtn = await page.$("button:has-text('看广告解锁')");
    if (adBtn) {
      console.log("  Found ad unlock button, clicking...");
      await adBtn.click();
      await page.screenshot({ path: path.join(OUT, "e2e_03_after_click.png"), fullPage: false });
      console.log("  [SCREENSHOT] e2e_03_after_click.png");
    } else {
      console.log("  WARNING: No unlock button found!");
      await page.screenshot({ path: path.join(OUT, "e2e_03_no_button.png"), fullPage: true });
      console.log("  [SCREENSHOT] e2e_03_no_button.png (fullpage)");
    }
  }

  // ── PART 5: Wait for tier2 to become ready ──
  console.log("\n[PART 5] Waiting for tier2 generation (max 3 min)");
  let tier2Ready = false;
  let contentVisible = false;
  const startTime = Date.now();

  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(2000);
    const text = await page.textContent("body");
    const hasContent = text.includes("核心建议") || text.includes("风格定位") || text.includes("推荐产品");
    const isProcessing = text.includes("AI 正在生成") || text.includes("请稍候");
    
    if (hasContent && !isProcessing) {
      tier2Ready = true;
      contentVisible = true;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log("  ✓ Tier2 content loaded after " + elapsed + "s");
      break;
    }
    
    if (i % 5 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log("  poll @" + elapsed + "s | status_reqs=" + statusRequests.length + " | content=" + hasContent + " | processing=" + isProcessing);
    }
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "e2e_04_final.png"), fullPage: false });
  console.log("  [SCREENSHOT] e2e_04_final.png");

  // ── PART 6: Wait to verify NO more requests after content loaded ──
  console.log("\n[PART 6] Verifying polling stopped (wait 15s)");
  const reqCountAfterReady = statusRequests.length;
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(2000);
    console.log("  post-ready t=" + (15 + (i+1)*2) + "s | total_status_reqs=" + statusRequests.length + " (new=" + (statusRequests.length - reqCountAfterReady) + ")");
  }

  const finalStatusCount = statusRequests.length;

  // ── PART 7: Summary ──
  console.log("\n========================================");
  console.log("  TEST RESULTS");
  console.log("========================================");
  console.log("  Total /tier2/status requests:", finalStatusCount);
  console.log("  Tier2 content in UI:", contentVisible ? "YES" : "NO");
  console.log("  API status responses:", statusResponses.length);
  
  if (statusResponses.length > 0) {
    console.log("\n  API Response timeline:");
    for (let i = 0; i < statusResponses.length; i++) {
      const sr = statusResponses[i];
      console.log("    #" + (i+1) + " [" + sr.status + "]" + (sr.hasContent ? " [CONTENT]" : ""));
    }
  }

  if (statusRequests.length >= 2) {
    const lastTwo = statusRequests.slice(-2);
    const lastGap = lastTwo[1].time - lastTwo[0].time;
    console.log("\n  Last request gap: " + lastGap + "ms");
    if (lastGap < 5000) {
      console.log("  ⚠ Requests still coming frequently - polling may not have stopped");
    } else {
      console.log("  ✓ Polling appears to have stopped");
    }
  }

  // Check final page state
  const finalText = await page.textContent("body");
  console.log("\n  Final page content (first 500 chars):");
  console.log("  " + finalText.substring(0, 500).replace(/\n/g, "\\n"));

  console.log("\n  Screenshots:", path.join(OUT, "e2e_*.png"));
  console.log("========================================\n");

  await browser.close();
  
  // Exit code: pass if content visible AND requests <= 15
  const passed = contentVisible && finalStatusCount <= 15;
  console.log("  FINAL: " + (passed ? "PASS ✓" : "FAIL ✗"));
  process.exit(passed ? 0 : 1);
})();
