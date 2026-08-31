const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://127.0.0.1:8788";
const OUT = "C:\\\\Users\\\\yao\\\\Documents\\\\ChatGPT\\\\美妆app\\\\test_output";

async function apiPost(path, body) {
  return new Promise((res, rej) => {
    const http = require("http");
    const req = http.request({ hostname: "127.0.0.1", port: 8788, path, method: "POST", headers: { "Content-Type": "application/json" } }, (r) => {
      let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } });
    });
    req.on("error", rej);
    req.setTimeout(10000, () => { req.destroy(); rej(new Error("timeout")); });
    req.write(JSON.stringify(body));
    req.end();
  });
}
async function apiGet(path) {
  return new Promise((res, rej) => {
    const http = require("http");
    const req = http.request({ hostname: "127.0.0.1", port: 8788, path, method: "GET" }, (r) => {
      let d = ""; r.on("data", c => d += c); r.on("end", () => { try { res(JSON.parse(d)); } catch { res(d); } });
    });
    req.on("error", rej);
    req.setTimeout(10000, () => { req.destroy(); rej(new Error("timeout")); });
    req.end();
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  pg.on("console", msg => console.log("[BR]", msg.type(), msg.text().substring(0, 150)));
  pg.on("pageerror", err => console.log("[PAGE ERROR]", err.message));

  // Step 1: Get SMS code via API
  await apiPost("/api/auth/phone/send-code", { phone: "13900000066" });
  const debugR = await apiGet("/api/debug/sms-code?phone=13900000066");
  const code = debugR.code;
  console.log("SMS Code:", code);

  // Step 2: Login via browser
  await pg.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(1000);

  // Click SMS tab
  await pg.locator('button:has-text("验证码登录")').click();
  await pg.waitForTimeout(500);

  // Fill and submit
  await pg.locator('input[placeholder*="手机号"]').fill("13900000066");
  await pg.locator('input[placeholder*="验证码"]').fill(code);
  
  // Intercept the login request to see what happens
  const loginResponse = await pg.evaluate(async () => {
    const phone = "13900000066";
    // We need the code from outside - use a global
    return window.__smsCode;
  });
  
  // Actually, let's just do it through the page
  await pg.locator('.login-btn').click();
  await pg.waitForTimeout(2000);
  
  console.log("After login, URL:", pg.url());
  
  const token = await pg.evaluate(() => localStorage.getItem("session_token"));
  console.log("Token in localStorage:", token ? token.substring(0, 30) + "..." : "NONE");

  // Step 3: Check what the server thinks about this token
  if (token) {
    const http = require("http");
    const checkR = await new Promise((res, rej) => {
      const req = http.request({ hostname: "127.0.0.1", port: 8788, path: "/api/reports/mine", method: "GET", headers: { "Authorization": "Bearer " + token } }, (r) => {
        let d = ""; r.on("data", c => d += c); r.on("end", () => res({ status: r.statusCode, body: d }));
      });
      req.on("error", rej);
      req.end();
    });
    console.log("Server check /api/reports/mine:", checkR.status, checkR.body);
    
    const tier2R = await new Promise((res, rej) => {
      const req = http.request({ hostname: "127.0.0.1", port: 8788, path: "/api/tier2/status?tier2Id=tier2-e2e-001", method: "GET", headers: { "Authorization": "Bearer " + token } }, (r) => {
        let d = ""; r.on("data", c => d += c); r.on("end", () => res({ status: r.statusCode, body: d }));
      });
      req.on("error", rej);
      req.end();
    });
    console.log("Server check tier2/status:", tier2R.status, tier2R.body);
  }

  // Step 4: Try navigating to tier2
  await pg.goto(BASE + "/tier2-result?reportId=tier2-e2e-001", { waitUntil: "networkidle", timeout: 20000 });
  await pg.waitForTimeout(3000);
  console.log("Tier2 URL:", pg.url());
  
  const bodyText = await pg.evaluate(() => document.body.innerText);
  console.log("Page text:", bodyText.substring(0, 500));

  await pg.screenshot({ path: OUT + "\\\\debug_tier2_flow.png", fullPage: true });
  console.log("Screenshot saved");

  await browser.close();
})().catch(e => { console.error("Failed:", e.message); process.exit(1); });
