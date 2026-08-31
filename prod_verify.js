const { chromium } = require("playwright");
const https = require("https");
const fs = require("fs");
const OUT = "C:/Users/yao/Documents/ChatGPT/美妆app/test_output";

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

  console.log("[1] Register/login user...");
  const regRes = await apiPost("/api/auth/login-or-register", {
    account: "tier2verify@test.com", password: "Test1234", confirmPassword: "Test1234"
  });
  const token = regRes.sessionId;
  console.log("  Token:", token ? token.substring(0, 8) + "..." : "FAILED: " + JSON.stringify(regRes));
  if (!token) { await browser.close(); return; }
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: token });

  console.log("[2] Admin login...");
  const adminRes = await apiPost("/api/admin/login", { username: "15961962243", password: "123456bn" });
  const adminToken = adminRes.sessionId;
  console.log("  Admin:", adminToken ? "OK" : "FAILED");

  console.log("[3] Syncing configs...");
  for (const u of [{key:"tier2_btn_color",value:"#000000"},{key:"tier2_show_ai_image",value:"true"},{key:"tier2_hook_text",value:"解锁专属报告，搭配更多场景"}]) {
    const r = await apiPost("/api/admin/config", u, adminToken);
    console.log("  " + u.key + "=" + u.value + ":", r.success ? "OK" : JSON.stringify(r));
  }

  console.log("[4] Uploading photo...");
  await pg.goto("https://44b4f35d.beauty-api-pages.pages.dev/capture", { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(2000);
  try {
    await pg.locator('input[type="file"]').setInputFiles("C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg");
    console.log("  Photo uploaded");
  } catch (e) {
    console.log("  Upload error:", e.message.substring(0, 100));
  }
  await pg.waitForTimeout(5000);

  const rid = await pg.evaluate(() => sessionStorage.getItem("capture_report_id"));
  console.log("  Tier1 report ID:", rid || "NOT_SET");

  await pg.screenshot({ path: OUT + "/P6_prod_capture.png" });
  console.log("  Screenshot: P6_prod_capture.png");

  await browser.close();
  console.log("\n=== DONE ===");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
