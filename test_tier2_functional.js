const { chromium } = require("playwright");
const http = require("http");
const BASE = "http://127.0.0.1:8788";
const OUT = "C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test_output";
const fs = require("fs");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function post(path, body, hdrs) {
  return new Promise((res, rej) => {
    const r = http.request({hostname:"127.0.0.1",port:8788,path,method:"POST",headers:hdrs||{"Content-Type":"application/json"}}, x => { let d=""; x.on("data",c=>d+=c); x.on("end",()=>{try{res(JSON.parse(d))}catch(e){res(d)}}); });
    r.on("error",rej); r.write(JSON.stringify(body)); r.end();
  });
}
function get(path, hdrs) {
  return new Promise((res, rej) => {
    const r = http.request({hostname:"127.0.0.1",port:8788,path,method:"GET",headers:hdrs||{}}, x => { let d=""; x.on("data",c=>d+=c); x.on("end",()=>{try{res(JSON.parse(d))}catch(e){res(d)}}); });
    r.on("error",rej); r.end();
  });
}

(async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();

  async function snap(n) {
    const p = OUT + "/" + n + ".png";
    await pg.screenshot({ path: p, fullPage: false });
    console.log("[SNAP]", n);
  }

  // Login
  await post("/api/auth/phone/send-code", { phone: "13900000001" });
  const codeR = await get("/api/debug/sms-code?phone=13900000001");
  const login = await post("/api/auth/phone/login", { phone: "13900000001", code: codeR.code });
  const userToken = login.sessionId || login.token;
  await pg.addInitScript(({ t }) => { localStorage.setItem("session_token", t); }, { t: userToken });

  // Admin login
  const adminLogin = await post("/api/admin/login", { username: "15961962243", password: "123456bn" });
  const adminToken = adminLogin.sessionId;

  const t2Id = "fdd82328-b059-4bd3-a353-6a46cb0291ea";
  await pg.goto(BASE + "/tier2-result?reportId=" + t2Id, { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);

  // ============================================================
  // CHECK 1: Modal - show ALL 6 dimensions' products by clicking each
  // ============================================================
  console.log("\n=== CHECK 1: Modal product cards ===");
  
  // Click each lightbulb and capture
  for (let i = 0; i < 6; i++) {
    // Click the i-th lightbulb
    await pg.locator(".t2-lightbulb-btn").nth(i).click();
    await pg.waitForTimeout(600);
    
    // Check modal content
    const modalInfo = await pg.evaluate(() => {
      const inner = document.querySelector(".t2-modal-overlay-inner");
      if (!inner) return null;
      const cards = inner.querySelectorAll(".t2-product-card");
      const nameEls = inner.querySelectorAll(".t2-product-name");
      const linkEls = inner.querySelectorAll(".t2-product-link-text");
      const copyEls = inner.querySelectorAll(".t2-copy-btn");
      const names = Array.from(nameEls).map(el => el.textContent.trim().substring(0, 20));
      const hasLinks = linkEls.length > 0;
      const hasCopies = copyEls.length > 0;
      const links = Array.from(linkEls).map(el => el.textContent.trim().substring(0, 30));
      return {
        productCount: cards.length,
        names,
        hasLinks,
        hasCopies,
        links
      };
    });
    console.log(`Dim ${i} modal:`, JSON.stringify(modalInfo));
    await snap("modal_dim_" + i);
    
    // Close modal
    const closeCount = await pg.locator(".t2-modal-close").count();
    if (closeCount > 0) {
      await pg.locator(".t2-modal-close").first().click();
      await pg.waitForTimeout(400);
    }
  }

  // Now click first modal again and scroll to show all products within
  console.log("\n--- Scrolling modal for dim 0 ---");
  await pg.locator(".t2-lightbulb-btn").first().click();
  await pg.waitForTimeout(600);
  
  const modalScrollInfo = await pg.evaluate(() => {
    const inner = document.querySelector(".t2-modal-overlay-inner");
    if (!inner) return { error: "no inner" };
    const cards = inner.querySelectorAll(".t2-product-card");
    return {
      productCount: cards.length,
      totalHeight: inner.scrollHeight,
      clientHeight: inner.clientHeight,
      canScroll: inner.scrollHeight > inner.clientHeight
    };
  });
  console.log("Modal scroll info:", JSON.stringify(modalScrollInfo));
  await snap("modal_full_0");
  
  // Scroll to see all products
  const innerEl = await pg.locator(".t2-modal-overlay-inner").first();
  for (let s = 0; s < 4; s++) {
    await innerEl.evaluate(el => { if (el.scrollTop + 200 < el.scrollHeight) el.scrollTop += 200; });
    await pg.waitForTimeout(300);
    await snap("modal_scroll_" + s);
  }

  // Check product card details (image, link, copy button)
  const productCardDetail = await pg.evaluate(() => {
    const cards = document.querySelectorAll(".t2-product-card");
    return Array.from(cards).map((card, i) => {
      const img = card.querySelector(".t2-product-img");
      const name = card.querySelector(".t2-product-name");
      const desc = card.querySelector(".t2-product-desc");
      const price = card.querySelector(".t2-product-price");
      const linkRow = card.querySelector(".t2-product-link-row");
      const linkEl = card.querySelector(".t2-product-link-text");
      const copyBtn = card.querySelector(".t2-copy-btn");
      return {
        index: i,
        name: name ? name.textContent.trim() : "(none)",
        imgComplete: img ? img.complete : false,
        imgNaturalW: img ? img.naturalWidth : 0,
        imgSrc: img ? img.src.substring(0, 60) : "(none)",
        hasDesc: !!desc,
        hasPrice: !!price,
        priceText: price ? price.textContent : "",
        hasLinkRow: !!linkRow,
        linkText: linkEl ? linkEl.textContent.trim().substring(0, 40) : "(none)",
        hasCopyBtn: !!copyBtn,
        copyBtnDisplay: copyBtn ? getComputedStyle(copyBtn).display : "n/a"
      };
    });
  });
  console.log("Product card details:", JSON.stringify(productCardDetail, null, 2));

  // Close modal
  await pg.locator(".t2-modal-close").click();
  await pg.waitForTimeout(400);

  // ============================================================
  // CHECK 2: Copy button - simulate click and verify via DOM
  // ============================================================
  console.log("\n=== CHECK 2: Copy button ===");
  await pg.locator(".t2-lightbulb-btn").first().click();
  await pg.waitForTimeout(600);
  
  const copyTest = await pg.evaluate(() => {
    const copyBtn = document.querySelector(".t2-copy-btn");
    if (!copyBtn) return { error: "no copy button" };
    const linkEl = copyBtn.closest(".t2-product-link-row")?.querySelector(".t2-product-link-text");
    const expectedLink = linkEl ? linkEl.textContent.trim() : null;
    
    // Check the button's onclick handler source
    const onClickSource = copyBtn.getAttribute("onclick");
    // Check if clipboard API is available
    const clipboardAvailable = typeof navigator.clipboard !== "undefined" && !!navigator.clipboard.writeText;
    
    // Simulate click and track if writeText was called
    let writeTextCalled = false;
    let writeTextArg = null;
    const origWriteText = navigator.clipboard?.writeText;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText = async (text) => {
        writeTextCalled = true;
        writeTextArg = text;
        return origWriteText.call(navigator.clipboard, text);
      };
    }
    
    copyBtn.click();
    
    // Restore
    if (origWriteText) navigator.clipboard.writeText = origWriteText;
    
    return {
      hasCopyBtn: true,
      expectedLink,
      clipboardAvailable,
      onClickSource: onClickSource || "(no inline onclick)",
      writeTextCalled,
      writeTextArg: writeTextArg ? writeTextArg.substring(0, 60) : "(not called)",
      btnTitle: copyBtn.title,
      btnText: copyBtn.textContent.trim()
    };
  });
  console.log("Copy test result:", JSON.stringify(copyTest, null, 2));

  await pg.locator(".t2-modal-close").click();
  await pg.waitForTimeout(400);

  // ============================================================
  // CHECK 3: Backend three toggles
  // ============================================================
  console.log("\n=== CHECK 3: Backend toggles ===");
  
  const saveConfig = async (key, value) => {
    const r = await post("/api/admin/config", { key, value }, { Authorization: "Bearer " + adminToken });
    console.log(`  ${key}=${value}:`, JSON.stringify(r).substring(0, 80));
    return r;
  };

  // 3a: Hide AI image
  console.log("\n--- 3a: tier2_show_ai_image=false ---");
  await saveConfig("tier2_show_ai_image", "false");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);
  const aiHidden = await pg.evaluate(() => {
    const hero = document.querySelector(".t2-card--hero");
    return hero ? "VISIBLE (BUG)" : "HIDDEN (OK)";
  });
  console.log("AI module:", aiHidden);
  await snap("check3a_ai_hidden");

  // Restore
  await saveConfig("tier2_show_ai_image", "true");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);

  // 3b: Red button color
  console.log("\n--- 3b: tier2_btn_color=#FF0000 ---");
  await saveConfig("tier2_btn_color", "#FF0000");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);
  const btnRed = await pg.evaluate(() => {
    const btns = document.querySelectorAll(".t2-btn, .t2-share-btn");
    return Array.from(btns).map(b => ({
      text: b.textContent.trim().substring(0,15),
      bg: getComputedStyle(b).backgroundColor
    }));
  });
  console.log("Buttons:", JSON.stringify(btnRed, null, 2));
  await snap("check3b_btn_red");

  // Restore
  await saveConfig("tier2_btn_color", "#000000");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);

  // 3c: Hook text
  console.log("\n--- 3c: tier2_hook_text update ---");
  await saveConfig("tier2_hook_text", "【新文案】解锁专属场景报告，解锁更多搭配方案");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(3000);
  const hookCheck = await pg.evaluate(() => {
    const el = document.querySelector(".t2-tier3-hook-text");
    if (!el) return { error: "not found" };
    const style = getComputedStyle(el);
    return {
      text: el.textContent.trim(),
      textAlign: style.textAlign,
      width: style.width,
      maxWidth: style.maxWidth
    };
  });
  console.log("Hook text:", JSON.stringify(hookCheck, null, 2));
  await snap("check3c_hook_text");

  // Restore
  await saveConfig("tier2_hook_text", "解锁专属报告，搭配更多场景");
  await pg.reload({ waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(2000);

  await browser.close();
  console.log("\n=== All tests done ===");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });