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

  await pg.goto(BASE + "/tier2-result?reportId=t2-e2e-1787880155", { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);

  // Detailed DOM inspection
  const domInspection = await pg.evaluate(() => {
    const cards = document.querySelectorAll(".t2-dim-card");
    return Array.from(cards).slice(0, 1).map(card => {
      const bulb = card.querySelector(".t2-lightbulb-btn");
      if (!bulb) return { error: "no bulb" };
      // Check the button's actual DOM attributes and styles
      const styleAttr = bulb.getAttribute("style");
      const computedStyle = getComputedStyle(bulb);
      const cardStyle = getComputedStyle(card);
      const header = card.querySelector(".t2-dim-header");
      const headerRect = header ? header.getBoundingClientRect() : null;
      const bulbRect = bulb.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return {
        styleAttr,
        computedPosition: computedStyle.position,
        computedTop: computedStyle.top,
        computedRight: computedStyle.right,
        cardOverflow: cardStyle.overflow,
        cardPosition: cardStyle.position,
        headerContainsBulb: header ? header.contains(bulb) : false,
        bulbRelativeTop: Math.round(bulbRect.top - cardRect.top),
        bulbRelativeRight: Math.round(cardRect.right - bulbRect.right),
        cardWidth: Math.round(cardRect.width),
        cardHeight: Math.round(cardRect.height)
      };
    });
  });
  console.log("DOM inspection:", JSON.stringify(domInspection, null, 2));

  // Check dimension section labels
  const sectionLabels = await pg.evaluate(() => {
    const cards = document.querySelectorAll(".t2-dim-card");
    return Array.from(cards).slice(0, 2).map((card, i) => {
      const sections = card.querySelectorAll(".t2-dim-section");
      return {
        cardIndex: i,
        sectionCount: sections.length,
        labels: Array.from(sections).map(s => s.querySelector(".t2-dim-section-label")?.textContent || "(none)"),
        textPreview: sections[0]?.querySelector(".t2-dim-section-text")?.innerText?.substring(0, 50) || "(none)"
      };
    });
  });
  console.log("Section labels:", JSON.stringify(sectionLabels, null, 2));

  await snap("tier2_v3_detailed");

  // Try clicking the lightbulb and check if modal appears
  const bulbCount = await pg.locator(".t2-lightbulb-btn").count();
  console.log("Lightbulb count:", bulbCount);
  if (bulbCount > 0) {
    await pg.locator(".t2-lightbulb-btn").first().click();
    await pg.waitForTimeout(500);
    
    // Check modal
    const modalCheck = await pg.evaluate(() => {
      const overlay = document.querySelector(".t2-modal-overlay");
      if (!overlay) return { exists: false };
      const inner = document.querySelector(".t2-modal-overlay-inner");
      const display = getComputedStyle(overlay).display;
      const hasProducts = inner ? inner.querySelectorAll(".t2-product-card").length : 0;
      const hasDimSections = inner ? inner.querySelectorAll(".t2-dim-section").length : 0;
      const hasCloseBtn = inner ? inner.querySelector(".t2-modal-close") !== null : false;
      return { exists: true, display, hasProducts, hasDimSections, hasCloseBtn };
    });
    console.log("Modal after click:", JSON.stringify(modalCheck));
    await snap("tier2_v3_modal_detail");

    // Close modal
    const closeBtn = await pg.locator(".t2-modal-close").count();
    if (closeBtn > 0) {
      await pg.locator(".t2-modal-close").click();
      await pg.waitForTimeout(300);
    }
  }

  // Also check button colors in detail
  const btnDetails = await pg.evaluate(() => {
    const btns = document.querySelectorAll(".t2-btn, .t2-share-btn");
    return Array.from(btns).map(b => ({
      text: b.textContent.trim().substring(0,20),
      className: b.className,
      bg: getComputedStyle(b).backgroundColor,
      inlineBg: b.style.background,
      computedBg: getComputedStyle(b).background
    }));
  });
  console.log("Button details:", JSON.stringify(btnDetails, null, 2));

  await browser.close();
  console.log("\nDone.");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });