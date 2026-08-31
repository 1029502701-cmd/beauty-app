const https = require("https");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PROD = "81eba90d.beauty-api-pages.pages.dev";
const OUT = path.join(process.cwd(), "test_output");
const PHOTO = path.join(process.cwd(), "test_face.jpg");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const NEW_PHONE = "13" + String(Date.now()).slice(-9);
const NEW_PASSWORD = "TestPoll" + String(Date.now()).slice(-4);

function apiPost(p, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: PROD, path: p, method: "POST", headers: hdrs }, x => {
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
    const r = https.request({ hostname: PROD, path: p, method: "GET", headers: hdrs }, x => {
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
    const r = https.request({ hostname: PROD, path: p, method: "POST", headers: hdrs }, x => {
      let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    });
    r.on("error", rej); r.setTimeout(60000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end(body);
  });
}

(async () => {
  console.log("\n========================================");
  console.log("  Tier2 Polling Fix Verification (PROD)");
  console.log("  Phone:", NEW_PHONE);
  console.log("========================================\n");

  // 1. Register & login
  console.log("[1] Registering...");
  const regRes = await apiPost("/api/auth/register", { account: NEW_PHONE, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
  console.log("    reg:", JSON.stringify(regRes).substring(0, 200));

  console.log("[2] Logging in...");
  const loginRes = await apiPost("/api/auth/phone/login-password", { phone: NEW_PHONE, password: NEW_PASSWORD });
  const token = loginRes.sessionId || loginRes.token;
  console.log("    token:", (token || "").substring(0, 40));

  // 2. Upload photo to get tier1 report
  console.log("[3] Uploading photo...");
  const t1Res = await apiMultipartPost("/api/tier1/analyze", "photo", PHOTO, token);
  const reportId = t1Res.reportId;
  console.log("    reportId:", reportId);

  // 3. Trigger tier2 generation via share
  console.log("[4] Triggering tier2 generation via share...");
  const shareRes = await apiPost("/api/tier1/share", { reportId }, token);
  console.log("    share:", JSON.stringify(shareRes).substring(0, 300));
  const tier2ReportId = shareRes.tier2ReportId;

  // 4. Poll the status API directly to verify it stops correctly
  console.log("[5] Polling tier2/status directly...");
  const statusRequests = [];
  const startTime = Date.now();
  let tier2Ready = false;
  let tier2Content = null;

  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const st = await apiGet("/api/tier2/status?tier2Id=" + encodeURIComponent(tier2ReportId), token);
    statusRequests.push({ time: Date.now() - startTime, status: st.generationStatus });
    console.log("    poll #" + (i+1) + ": " + st.generationStatus + (st.generationStatus === "ready" ? " ✓" : ""));
    if (st.generationStatus === "ready") {
      tier2Ready = true;
      tier2Content = st.content;
      break;
    }
    if (st.generationStatus === "failed") {
      console.log("    FAILED!");
      break;
    }
  }

  const elapsed = Date.now() - startTime;
  const totalRequests = statusRequests.length;

  // 5. Launch browser and verify UI behavior
  console.log("\n[6] Launching browser to verify UI...");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript((tok) => {
    localStorage.setItem("session_token", tok);
  }, token);

  const reportUrl = "https://81eba90d.beauty-api-pages.pages.dev/report?id=" + encodeURIComponent(reportId);
  console.log("    Navigating to:", reportUrl);
  await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.screenshot({ path: path.join(OUT, "poll_prod_step1_loaded.png"), fullPage: false });
  console.log("    [SCREENSHOT] step1_loaded");

  // Monitor network requests
  const uiStatusRequests = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/tier2/status")) {
      uiStatusRequests.push({ time: Date.now(), url: url });
      console.log("    [UI NETWORK] tier2/status #" + uiStatusRequests.length + " → " + url.substring(0, 100));
    }
  });

  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "poll_prod_step2_before_unlock.png"), fullPage: false });
  console.log("    [SCREENSHOT] step2_before_unlock");

  // Check page state
  const pageText = await page.textContent("body");
  const hasUnlockBtn = pageText.includes("分享解锁") || pageText.includes("看广告解锁");
  const hasProcessing = pageText.includes("AI 正在生成") || pageText.includes("请稍候");
  const hasContent = pageText.includes("核心建议") || pageText.includes("风格定位");
  console.log("    Has unlock btn:", hasUnlockBtn);
  console.log("    Has processing:", hasProcessing);
  console.log("    Has content:", hasContent);

  // If not already ready, wait for content
  if (!hasContent && tier2Ready) {
    console.log("    Content already ready via API, waiting for UI to catch up...");
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000);
      const pt = await page.textContent("body");
      if (pt.includes("核心建议") || pt.includes("风格定位")) {
        console.log("    ✓ UI content loaded after ~" + ((i+1)*2) + "s");
        break;
      }
    }
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "poll_prod_step3_final.png"), fullPage: false });
  console.log("    [SCREENSHOT] step3_final");

  // Wait to see if more status requests come after content loaded
  await page.waitForTimeout(5000);
  const finalUiStatusCount = uiStatusRequests.length;

  // 6. Summary
  console.log("\n========================================");
  console.log("  RESULTS");
  console.log("========================================");
  console.log("  API polling - total /tier2/status requests:", totalRequests);
  console.log("  API polling - elapsed time:", elapsed / 1000 + "s");
  console.log("  API polling - tier2 ready:", tier2Ready ? "YES" : "NO");
  console.log("  UI network - total /tier2/status requests:", finalUiStatusCount);
  console.log("  UI content loaded:", hasContent ? "YES ✓" : "NO ✗");

  if (statusRequests.length > 0) {
    console.log("\n  API polling timing:");
    for (let i = 0; i < statusRequests.length; i++) {
      const sr = statusRequests[i];
      console.log("    #" + (i+1) + " @" + sr.time + "ms [" + sr.status + "]");
    }
  }

  if (uiStatusRequests.length >= 2) {
    const lastTwo = uiStatusRequests.slice(-2);
    const timeDiff = lastTwo[1].time - lastTwo[0].time;
    console.log("\n  UI request timing:");
    for (let i = 0; i < uiStatusRequests.length; i++) {
      console.log("    #" + (i+1) + " @" + (uiStatusRequests[i].time - uiStatusRequests[0].time) + "ms");
    }
    if (timeDiff < 5000) {
      console.log("  ⚠ Last requests only " + timeDiff + "ms apart - may not have stopped properly");
    } else {
      console.log("  ✓ Requests stopped properly (last gap: " + timeDiff + "ms)");
    }
  }

  console.log("\n  Screenshots:", path.join(OUT, "poll_prod_*.png"));
  console.log("========================================\n");

  await browser.close();
  process.exit(tier2Ready && finalUiStatusCount < 20 ? 0 : 1);
})();
