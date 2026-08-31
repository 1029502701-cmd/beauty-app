const https = require("https");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PROD = "81eba90d.beauty-api-pages.pages.dev";
const OUT = path.join(process.cwd(), "test_output");

const NEW_PHONE = "13" + String(Date.now()).slice(-9);
const NEW_PASSWORD = "PollTest" + String(Date.now()).slice(-4);

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
  console.log("  Full E2E: Register -> Analyze -> Unlock -> Poll");
  console.log("  Phone:", NEW_PHONE);
  console.log("========================================\n");

  // 1. Register & login
  const regRes = await apiPost("/api/auth/register", { account: NEW_PHONE, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
  console.log("[1] Registered:", JSON.stringify(regRes).substring(0, 100));
  const token = regRes.sessionId || regRes.token;

  const loginRes = await apiPost("/api/auth/phone/login-password", { phone: NEW_PHONE, password: NEW_PASSWORD });
  const t = loginRes.sessionId || loginRes.token;
  console.log("[2] Logged in, token:", (t || "").substring(0, 40));

  // 2. Upload photo
  const t1Res = await apiMultipartPost("/api/tier1/analyze", "photo", path.join(process.cwd(), "test_face.jpg"), t);
  const reportId = t1Res.reportId;
  console.log("[3] Tier1 reportId:", reportId);

  // 3. Trigger share (which starts tier2 generation)
  const shareRes = await apiPost("/api/tier1/share", { reportId }, t);
  const tier2ReportId = shareRes.tier2ReportId;
  console.log("[4] Tier2 reportId:", tier2ReportId);
  console.log("    share token:", shareRes.token);

  // 4. Poll API directly to track generation
  console.log("\n[5] Polling API for generation completion...");
  const apiPolls = [];
  let apiReady = false;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const st = await apiGet("/api/tier2/status?tier2Id=" + encodeURIComponent(tier2ReportId), t);
    apiPolls.push({ i: i+1, status: st.generationStatus, time: Date.now() });
    const ts = ((Date.now() - apiPolls[0].time) / 1000).toFixed(1);
    console.log("    api poll #" + (i+1) + " @" + ts + "s: " + st.generationStatus);
    if (st.generationStatus === "ready") {
      apiReady = true;
      console.log("    ✓ API says READY after " + ((Date.now() - apiPolls[0].time) / 1000).toFixed(1) + "s");
      break;
    }
    if (st.generationStatus === "failed") {
      console.log("    ✗ FAILED");
      break;
    }
  }

  if (!apiReady) {
    console.log("    Timeout waiting for ready state");
    await browser && browser.close();
    process.exit(1);
  }

  // 5. Now test in browser - navigate to report page
  console.log("\n[6] Launching browser...");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript((tok) => {
    localStorage.setItem("session_token", tok);
  }, t);

  const reportUrl = "https://81eba90d.beauty-api-pages.pages.dev/report?id=" + encodeURIComponent(reportId);
  console.log("    Navigating to:", reportUrl);
  await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.screenshot({ path: path.join(OUT, "e2e_step1_loaded.png"), fullPage: false });
  console.log("    [SCREENSHOT] step1_loaded");

  // Monitor all network requests
  const allRequests = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/tier2/status") || url.includes("/tier2/generate")) {
      allRequests.push({ time: Date.now(), type: url.includes("/status") ? "status" : "generate", url: url });
      console.log("    [NETWORK] " + (url.includes("/status") ? "STATUS" : "GENERATE") + " #" + allRequests.length + " -> " + url.substring(url.indexOf("/tier2")));
    }
  });

  await page.waitForTimeout(3000);

  // Check what the page shows
  const pageText = await page.textContent("body");
  const hasContent = pageText.includes("核心建议") || pageText.includes("风格定位");
  const hasProcessing = pageText.includes("AI 正在生成") || pageText.includes("请稍候");
  const hasUnlock = pageText.includes("分享解锁") || pageText.includes("看广告解锁");
  console.log("    Page: content=" + hasContent + " processing=" + hasProcessing + " unlock=" + hasUnlock);
  console.log("    Text preview:", pageText.substring(0, 300));

  await page.screenshot({ path: path.join(OUT, "e2e_step2_state.png"), fullPage: false });
  console.log("    [SCREENSHOT] step2_state");

  // Since report is already ready, we should see the content
  // Wait a bit more to check if any extra polling happens
  console.log("\n[7] Waiting 20s to check for continued polling...");
  const reqCountAtStart = allRequests.length;
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);
    const newText = await page.textContent("body");
    const newContent = newText.includes("核心建议") || newText.includes("风格定位");
    const newReqs = allRequests.length - reqCountAtStart;
    console.log("    t=" + ((i+1)*2) + "s | content=" + newContent + " | new_reqs=" + newReqs);
    if (newContent && newReqs === 0) {
      console.log("    ✓ No extra polling, content visible!");
      break;
    }
  }

  await page.screenshot({ path: path.join(OUT, "e2e_step3_final.png"), fullPage: false });
  console.log("    [SCREENSHOT] step3_final");

  // Final summary
  const finalText = await page.textContent("body");
  const finalContent = finalText.includes("核心建议") || finalText.includes("风格定位");
  const finalReqCount = allRequests.length;

  console.log("\n========================================");
  console.log("  RESULTS");
  console.log("========================================");
  console.log("  API polls (direct):", apiPolls.length);
  console.log("  UI network requests (tier2/status+generate):", finalReqCount);
  console.log("  Tier2 ready (API):", apiReady ? "YES" : "NO");
  console.log("  Content in UI:", finalContent ? "YES ✓" : "NO ✗");

  if (finalReqCount <= 5 && finalContent) {
    console.log("\n  ✓ PASS: Fix verified! Polling stopped correctly and content displayed.");
  } else if (finalReqCount > 10) {
    console.log("\n  ✗ FAIL: Too many requests (" + finalReqCount + ") - polling may not have stopped!");
  } else {
    console.log("\n  ~ PARTIAL: " + finalReqCount + " requests, content=" + finalContent);
  }

  // Show request timeline
  if (allRequests.length > 0) {
    console.log("\n  UI Request timeline:");
    for (let i = 0; i < allRequests.length; i++) {
      const t = allRequests[i].time - allRequests[0].time;
      console.log("    #" + (i+1) + " [" + allRequests[i].type + "] @" + t + "ms");
    }
  }

  console.log("\n  Screenshots:", path.join(OUT, "e2e_*.png"));
  console.log("========================================\n");

  await browser.close();
  process.exit((finalReqCount <= 10 && finalContent) ? 0 : 1);
})();
