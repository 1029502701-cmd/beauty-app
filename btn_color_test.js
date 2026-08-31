const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = "test_output";
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const TIER1_ID = "t1-001";

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  
  page.on("pageerror", err => console.log("JS ERR:", err.message));
  page.on("console", msg => {
    if (msg.type() === "log") console.log("LOG:", msg.text().substring(0, 100));
  });

  await page.goto("http://127.0.0.1:8788/", { waitUntil: "domcontentloaded" });

  // Login
  await page.evaluate(async () => {
    await fetch("http://127.0.0.1:8788/api/auth/phone/send-code", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({phone:"13900000001"})
    });
  });
  await page.waitForTimeout(200);
  const smsCode = (await page.evaluate(async () => {
    const r = await fetch("http://127.0.0.1:8788/api/debug/sms-code?phone=13900000001");
    return (await r.json()).code;
  }));
  const loginData = await page.evaluate(async (params) => {
    const r = await fetch("http://127.0.0.1:8788/api/auth/phone/login", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({phone:params.phone, code:params.code})
    });
    return r.json();
  }, {phone:"13900000001", code:smsCode});
  const token = loginData?.sessionId || loginData?.token;
  console.log("Token:", token);
  
  // Set token BEFORE navigating to report page
  await page.addInitScript(t => {
    localStorage.setItem("session_token", t);
    sessionStorage.setItem("session_token", t);
  }, token);

  console.log("=== Navigate to /report ===");
  await page.goto("http://127.0.0.1:8788/report?id=" + TIER1_ID + "&tab=进阶", { waitUntil: "networkidle", timeout: 15000 });
  
  // Poll for the tier2 UI to appear
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasStepCard = document.querySelectorAll(".t2-step-card").length;
      const hasHookBtn = !!document.querySelector(".t2-btn-hook");
      const hasHero = !!document.querySelector(".t2-card--hero");
      return {
        text: text.substring(0, 200),
        hasStepCard, hasHookBtn, hasHero,
        steps: hasStepCard
      };
    });
    console.log("Poll", i+1, ":", JSON.stringify(info));
    if (info.hasStepCard > 0 || info.hasHookBtn) break;
  }

  // Final check
  const finalInfo = await page.evaluate(() => ({
    hasT2Hero: !!document.querySelector(".t2-card--hero"),
    hasStepCard: document.querySelectorAll(".t2-step-card").length,
    hasHookBtn: !!document.querySelector(".t2-btn-hook"),
    hasShareBtn: !!document.querySelector(".t2-share-btn"),
    bodyText: document.body.innerText.substring(0, 400),
  }));
  console.log("Final:", JSON.stringify(finalInfo, null, 2));

  // Check button color
  const hookBtnEl = page.locator(".t2-btn-hook").first();
  const btnCount = await hookBtnEl.count();
  if (btnCount > 0) {
    const btnBg = await hookBtnEl.evaluate(el => window.getComputedStyle(el).backgroundColor);
    console.log("Button bg:", btnBg);
  }

  await page.screenshot({ path: path.join(OUT, "e2e_report_final2.png"), fullPage: true });
  console.log("Screenshot saved to test_output/e2e_report_final2.png");

  await browser.close();
})();