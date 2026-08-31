const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const API_HOST = "127.0.0.1";
const API_PORT = 8788;
const APP = "http://localhost:5174";
const OUT = path.join(process.cwd(), "test_output");
const PHOTO = path.join(process.cwd(), "test_face.jpg");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const NEW_PHONE = "13" + String(Date.now()).slice(-9);
const NEW_PASSWORD = "TestPic" + String(Date.now()).slice(-4);

function apiPost(p, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = http.request({ hostname: API_HOST, port: API_PORT, path: p, method: "POST", headers: hdrs }, x => {
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
    const r = http.request({ hostname: API_HOST, port: API_PORT, path: p, method: "GET", headers: hdrs }, x => {
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
    const r = http.request({ hostname: API_HOST, port: API_PORT, path: p, method: "POST", headers: hdrs }, x => {
      let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    });
    r.on("error", rej); r.setTimeout(60000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end(body);
  });
}

(async () => {
  console.log("\n========================================");
  console.log("  Tier2 Polling Fix Verification");
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

  // 3. Launch browser and navigate
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set auth token in localStorage
  await page.addInitScript((tok) => {
    localStorage.setItem("session_token", tok);
  }, token);

  // 4. Navigate to report page
  const reportUrl = APP + "/report?id=" + encodeURIComponent(reportId);
  console.log("[4] Navigating to:", reportUrl);
  await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.screenshot({ path: path.join(OUT, "poll_test_step1_loaded.png"), fullPage: false });
  console.log("    [SCREENSHOT] step1_loaded");

  // 5. Wait for page to fully render
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "poll_test_step2_before_unlock.png"), fullPage: false });
  console.log("    [SCREENSHOT] step2_before_unlock");

  // 6. Set up network monitoring
  const statusRequests = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/tier2/status")) {
      statusRequests.push({
        time: Date.now(),
        url: url,
        method: req.method()
      });
      console.log("    [NETWORK] tier2/status #" + statusRequests.length + " -> " + url.substring(0, 120));
    }
  });

  // 7. Check page state and click unlock
  console.log("[5] Looking for unlock buttons...");
  await page.waitForTimeout(2000);

  const pageText = await page.textContent("body");
  console.log("    Page text preview:", pageText.substring(0, 500));

  const shareBtn = await page.$("button:has-text('分享解锁'), button:has-text('去分享解锁'), button:has-text('分享解锁进阶报告')");
  if (shareBtn) {
    console.log("[6] Clicking share unlock button...");
    await shareBtn.click();
    await page.screenshot({ path: path.join(OUT, "poll_test_step3_after_click.png"), fullPage: false });
    console.log("    [SCREENSHOT] step3_after_click");
  } else {
    const adBtn = await page.$("button:has-text('看广告解锁')");
    if (adBtn) {
      console.log("[6] Clicking ad unlock button...");
      await adBtn.click();
      await page.screenshot({ path: path.join(OUT, "poll_test_step3_after_click.png"), fullPage: false });
      console.log("    [SCREENSHOT] step3_after_click");
    } else {
      console.log("[6] No unlock button found, taking full page screenshot...");
      await page.screenshot({ path: path.join(OUT, "poll_test_step3_fullpage.png"), fullPage: true });
      console.log("    [SCREENSHOT] step3_fullpage");
    }
  }

  // 8. Wait for generation to complete
  console.log("[7] Waiting for tier2 generation (max 3 min)...");
  let tier2Ready = false;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent("body");
    const hasContent = bodyText.includes("核心建议") || bodyText.includes("风格定位") || bodyText.includes("推荐产品");
    const stillProcessing = bodyText.includes("AI 正在生成") || bodyText.includes("请稍候") || bodyText.includes("processing");

    if (hasContent && !stillProcessing) {
      tier2Ready = true;
      console.log("    ✓ Tier2 content loaded after ~" + ((i+1)*2) + "s");
      break;
    }
    if (i % 5 === 0) {
      console.log("    poll " + (i+1) + "/90 | statusReq=" + statusRequests.length + " | processing=" + stillProcessing + " | hasContent=" + hasContent);
    }
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, "poll_test_step4_final.png"), fullPage: false });
  console.log("    [SCREENSHOT] step4_final");

  // 9. Check if requests stopped
  await page.waitForTimeout(3000);
  const finalStatusCount = statusRequests.length;

  // 10. Summary
  console.log("\n========================================");
  console.log("  RESULTS");
  console.log("========================================");
  console.log("  Total /tier2/status requests:", finalStatusCount);
  console.log("  Tier2 content loaded:", tier2Ready ? "YES ✓" : "NO ✗");

  if (statusRequests.length > 0) {
    console.log("\n  Request timing:");
    let prevTime = statusRequests[0].time;
    for (let i = 0; i < statusRequests.length; i++) {
      const sr = statusRequests[i];
      const delta = sr.time - prevTime;
      const fromStart = sr.time - statusRequests[0].time;
      console.log("    #" + (i+1) + " @" + fromStart + "ms (+" + delta + "ms)");
      prevTime = sr.time;
    }
  }

  if (statusRequests.length >= 2) {
    const lastTwo = statusRequests.slice(-2);
    const timeDiff = lastTwo[1].time - lastTwo[0].time;
    if (timeDiff < 5000) {
      console.log("\n  ⚠ Requests still close together (" + timeDiff + "ms) - may not have stopped properly");
    } else {
      console.log("\n  ✓ Requests stopped properly (last gap: " + timeDiff + "ms)");
    }
  }

  console.log("\n  Screenshots:", path.join(OUT, "poll_test_*.png"));
  console.log("========================================\n");

  await browser.close();
  process.exit(tier2Ready && finalStatusCount < 20 ? 0 : 1);
})();
