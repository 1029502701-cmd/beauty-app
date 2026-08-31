const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:8788";
const OUT = "C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test_output";
const fs = require("fs");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  async function snap(n) {
    const p = OUT + "/" + n + ".png";
    await pg.screenshot({ path: p, fullPage: false });
    console.log("[SNAP]", n);
  }

  // Login
  const http = require("http");
  function post(path, body) {
    return new Promise((res, rej) => {
      const r = http.request({hostname:"127.0.0.1",port:8788,path,method:"POST",headers:{"Content-Type":"application/json"}}, x => { let d=""; x.on("data",c=>d+=c); x.on("end",()=>{try{res(JSON.parse(d))}catch(e){res(d)}}); });
      r.on("error",rej); r.write(JSON.stringify(body)); r.end();
    });
  }
  function get(path, hdrs) {
    return new Promise((res, rej) => {
      const r = http.request({hostname:"127.0.0.1",port:8788,path,method:"GET",headers:hdrs||{}}, x => { let d=""; x.on("data",c=>d+=c); x.on("end",()=>{try{res(JSON.parse(d))}catch(e){res(d)}}); });
      r.on("error",rej); r.end();
    });
  }

  await post("/api/auth/phone/send-code", { phone: "13900000001" });
  const codeR = await get("/api/debug/sms-code?phone=13900000001");
  const login = await post("/api/auth/phone/login", { phone: "13900000001", code: codeR.code });
  const token = login.sessionId || login.token;
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: token });
  console.log("Logged in");

  // Navigate to tier2 result page
  const t2Id = "fdd82328-b059-4bd3-a353-6a46cb0291ea";
  await pg.goto(BASE + "/tier2-result?reportId=" + t2Id, { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(4000);
  console.log("URL:", pg.url());

  // === CHECK 1: Button colors ===
  const btnDetails = await pg.evaluate(() => {
    const btns = document.querySelectorAll(".t2-btn, .t2-share-btn");
    return Array.from(btns).map(b => ({
      text: b.textContent.trim().substring(0,20),
      bg: getComputedStyle(b).backgroundColor,
      inlineBg: b.style.background
    }));
  });
  console.log("1. Button colors:", JSON.stringify(btnDetails, null, 2));

  // === CHECK 2: Lightbulb position ===
  const bulbInfo = await pg.evaluate(() => {
    const cards = document.querySelectorAll(".t2-dim-card");
    return Array.from(cards).map((card, i) => {
      const bulb = card.querySelector(".t2-lightbulb-btn");
      if (!bulb) return { index: i, hasBulb: false };
      const rect = bulb.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const relTop = Math.round(rect.top - cardRect.top);
      const relRight = Math.round(cardRect.right - rect.right);
      return { index: i, hasBulb: true, relTop, relRight, position: bulb.style.position };
    });
  });
  console.log("2. Bulb positions:", JSON.stringify(bulbInfo, null, 2));

  // === CHECK 3: Dimension card content structure ===
  const dimStructure = await pg.evaluate(() => {
    const cards = document.querySelectorAll(".t2-dim-card");
    return Array.from(cards).map((card, i) => {
      const sections = card.querySelectorAll(".t2-dim-section");
      const labels = Array.from(sections).map(s => s.querySelector(".t2-dim-section-label")?.textContent || "");
      const texts = Array.from(sections).map(s => {
        const p = s.querySelector(".t2-dim-section-text");
        return p ? p.innerText.substring(0, 40) : "";
      });
      const hasProductSection = card.querySelector(".t2-product-section") !== null;
      return {
        index: i,
        sectionCount: sections.length,
        labels,
        textPreviews: texts,
        hasProductSection
      };
    });
  });
  console.log("3. Dim card structure:", JSON.stringify(dimStructure, null, 2));

  await snap("tier2_real_data_full");

  // === CHECK 4: Click lightbulb, verify modal only has products ===
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count();
  console.log("Lightbulb count:", bulbCount);
  if (bulbCount > 0) {
    await pg.locator(".t2-lightbulb-btn").first().click();
    await pg.waitForTimeout(800);
    await snap("tier2_real_data_modal");

    const modalCheck = await pg.evaluate(() => {
      const overlay = document.querySelector(".t2-modal-overlay");
      if (!overlay) return null;
      const inner = document.querySelector(".t2-modal-overlay-inner");
      if (!inner) return { exists: true, error: "no inner" };
      const display = getComputedStyle(overlay).display;
      const hasProducts = inner.querySelectorAll(".t2-product-card").length;
      const hasDimSections = inner.querySelectorAll(".t2-dim-section").length;
      const hasCloseBtn = inner.querySelector(".t2-modal-close") !== null;
      const hasTitle = inner.querySelector(".t2-modal-title") !== null;
      const textPreview = inner.innerText.substring(0, 200);
      return {
        exists: true,
        display,
        hasProducts,
        hasDimSections,
        hasCloseBtn,
        hasTitle,
        textPreview
      };
    });
    console.log("4. Modal content:", JSON.stringify(modalCheck, null, 2));

    // Close modal
    await pg.locator(".t2-modal-close").click();
    await pg.waitForTimeout(400);
  }

  // === CHECK 5: Verify three sections are visible without clicking ===
  const visibleSections = await pg.evaluate(() => {
    const cards = document.querySelectorAll(".t2-dim-card");
    return Array.from(cards).slice(0, 3).map((card, i) => {
      const sections = card.querySelectorAll(".t2-dim-section");
      const visible = Array.from(sections).filter(s => {
        const style = getComputedStyle(s);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      return {
        cardIndex: i,
        totalSections: sections.length,
        visibleSections: visible.length,
        sectionLabels: Array.from(sections).map(s => s.querySelector(".t2-dim-section-label")?.textContent || "")
      };
    });
  });
  console.log("5. Visible sections:", JSON.stringify(visibleSections, null, 2));

  await browser.close();
  console.log("\n=== All checks done. Screenshots in", OUT);
})().catch(e => { console.error("ERROR:", e.message, e.stack); process.exit(1); });