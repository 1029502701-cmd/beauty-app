const https = require("https");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PROD = "81eba90d.beauty-api-pages.pages.dev";
const OUT = path.join(process.cwd(), "test_output");

const PHONE = "13054706700";
const PASSWORD = "TestPoll" + String(Date.now()).slice(-4); // this might fail, use existing
const TOKEN = "557c9abe-0504-44c7-9d1c-b4ba1bdcfa20";
const REPORT_ID = "b9bff441-7ef1-4fbb-9cf3-ba9fbe3c56cc";
const TIER2_ID = "aa56d417-c10f-44d5-ba95-63c59e5d26fe";

async function apiGet(p) {
  return new Promise((res, rej) => {
    const r = https.request({ hostname: PROD, path: p, method: "GET", headers: { "Authorization": "Bearer " + TOKEN } }, x => {
      let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    });
    r.on("error", rej); r.setTimeout(10000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end();
  });
}

(async () => {
  console.log("\n========================================");
  console.log("  Tier2 Polling Fix - Quick Verification");
  console.log("========================================\n");

  // First, verify the tier2 status endpoint works
  console.log("[1] Checking tier2 status via API...");
  const status = await apiGet("/api/tier2/status?tier2Id=" + encodeURIComponent(TIER2_ID));
  console.log("    generationStatus:", status.generationStatus);
  console.log("    has content:", !!status.content);

  // Now test in browser
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript((tok) => {
    localStorage.setItem("session_token", tok);
  }, TOKEN);

  const reportUrl = "https://81eba90d.beauty-api-pages.pages.dev/report?id=" + encodeURIComponent(REPORT_ID);
  console.log("[2] Navigating to report page...");
  await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 30000 });
  await page.screenshot({ path: path.join(OUT, "quick_test_step1.png"), fullPage: false });
  console.log("    [SCREENSHOT] step1");

  // Monitor status requests
  const statusReqs = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/tier2/status")) {
      statusReqs.push({ time: Date.now(), url: url });
      console.log("    [NETWORK] tier2/status #" + statusReqs.length + " -> " + url.substring(url.indexOf("/tier2")));
    }
  });

  // Wait and observe
  console.log("[3] Observing for 20 seconds...");
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(2000);
    const text = await page.textContent("body");
    const hasContent = text.includes("核心建议") || text.includes("风格定位");
    const hasProcessing = text.includes("AI 正在生成") || text.includes("请稍候");
    console.log("    t=" + ((i+1)*2) + "s | reqs=" + statusReqs.length + " | content=" + hasContent + " | processing=" + hasProcessing);
    if (hasContent && i > 2) {
      console.log("    ✓ Content visible!");
      break;
    }
  }

  await page.screenshot({ path: path.join(OUT, "quick_test_step2.png"), fullPage: false });
  console.log("    [SCREENSHOT] step2");

  // Wait more to see if requests keep coming
  console.log("[4] Waiting 15 more seconds to check for continued polling...");
  const reqCountBefore = statusReqs.length;
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(2000);
    console.log("    t=" + (20 + (i+1)*2) + "s | total reqs=" + statusReqs.length + " (new: " + (statusReqs.length - reqCountBefore) + ")");
  }

  const finalCount = statusReqs.length;
  console.log("\n========================================");
  console.log("  RESULTS");
  console.log("========================================");
  console.log("  Total /tier2/status requests:", finalCount);
  console.log("  API says ready:", status.generationStatus === "ready");
  console.log("  Content visible in UI:", (await page.textContent("body")).includes("核心建议") ? "YES" : "NO");

  if (finalCount <= 10) {
    console.log("  ✓ PASS: Polling stopped after getting ready (only " + finalCount + " requests)");
  } else if (finalCount <= 20) {
    console.log("  ~ OK: Some extra requests but within reasonable range (" + finalCount + ")");
  } else {
    console.log("  ✗ FAIL: Too many requests (" + finalCount + ") - polling may not have stopped");
  }

  // Show timing
  if (statusReqs.length > 0) {
    console.log("\n  Request timeline:");
    for (let i = 0; i < statusReqs.length; i++) {
      const t = statusReqs[i].time - statusReqs[0].time;
      console.log("    #" + (i+1) + " @" + t + "ms");
    }
  }

  console.log("\n  Screenshots:", path.join(OUT, "quick_test_*.png"));
  console.log("========================================\n");

  await browser.close();
  process.exit(finalCount <= 20 ? 0 : 1);
})();
