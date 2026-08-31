const { chromium } = require("playwright");
const BASE = "https://beauty-api-pages.pages.dev";
const SCREENSHOT_DIR = "C:/Users/yao/Documents/ChatGPT/美妆app/test_output";
const PHOTO_PATH = "C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg";

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  page.on("console", msg => console.log("[BROWSER]", msg.type(), msg.text().substring(0, 120)));
  page.on("pageerror", err => console.log("[PAGE ERROR]", err.message.substring(0, 100)));
  
  // Register
  const phone = "139" + String(Math.floor(Math.random() * 100000000)).padStart(8, "0");
  const password = "TestImg" + Date.now();
  console.log("[1] Registering:", phone);
  await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  
  await page.fill('input[placeholder*="手机"]', phone);
  await page.fill('input[placeholder*="密码"]', password);
  await page.fill('input[placeholder*="再次"]', password);
  await page.click('button.login-btn');
  await page.waitForTimeout(3000);
  const token = await page.evaluate(() => localStorage.getItem("session_token"));
  console.log("[1] Token:", token ? token.substring(0, 20) : "NONE");
  
  if (!token) {
    console.log("[FAIL] Registration failed");
    await browser.close();
    return;
  }
  
  // Upload photo and trigger tier1
  console.log("[2] Uploading photo...");
  await page.goto(BASE + "/capture", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2000);
  
  try {
    await page.locator('input[type="file"]').setInputFiles(PHOTO_PATH);
    console.log("  Photo uploaded");
  } catch (e) {
    console.log("  Photo upload failed:", e.message.substring(0, 100));
  }
  
  // Wait for tier1 analysis to complete
  console.log("[3] Waiting for tier1 analysis...");
  let reportId = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(3000);
    reportId = await page.evaluate(() => sessionStorage.getItem("capture_report_id"));
    if (reportId) {
      console.log("  Report ID:", reportId.substring(0, 20));
      break;
    }
    if (i % 5 === 4) console.log("  [" + (i+1) + "] Still analyzing...");
  }
  
  if (!reportId) {
    console.log("[FAIL] No report ID found");
    await browser.close();
    return;
  }
  
  // Trigger tier2 via share
  console.log("[4] Triggering tier2 generation...");
  const shareRes = await page.evaluate(({ rid, tok }) => fetch(BASE + "/api/tier1/share", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok },
    body: JSON.stringify({ reportId: rid }),
  }).then(r => r.json()), { rid: reportId, tok: token });
  console.log("  Tier2 ID:", shareRes.tier2ReportId ? shareRes.tier2ReportId.substring(0, 8) : "NONE");
  
  // Poll for tier2 completion
  console.log("[5] Polling for tier2 completion...");
  let tier2Id = shareRes.tier2ReportId;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(5000);
    const status = await page.evaluate(({ tid, tok }) => fetch(BASE + "/api/tier2/status?tier2Id=" + tid, {
      headers: { Authorization: "Bearer " + tok }
    }).then(r => r.json()), { tid: tier2Id, tok: token });
    console.log("  [" + (i+1) + "] " + status.generationStatus);
    if (status.generationStatus === "ready" || status.generationStatus === "failed") {
      console.log("  Final:", status.generationStatus);
      break;
    }
  }
  
  // Navigate to report
  console.log("[6] Navigating to report...");
  await page.evaluate(({ rid }) => {
    window.history.pushState({ reportId: rid }, "", "/report");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, { rid: reportId });
  await page.waitForTimeout(5000);
  console.log("  URL:", page.url());
  
  // Click 进阶 tab
  console.log("[7] Opening 进阶 tab...");
  const tabs = await page.locator(".report-tab").all();
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text.includes("进阶")) {
      await tab.click();
      await page.waitForTimeout(3000);
      break;
    }
  }
  
  // Expand all dimensions
  console.log("[8] Expanding dimensions...");
  const dimCount = await page.locator(".report-dim-header").count();
  console.log("  Found", dimCount, "dimensions");
  for (let i = 0; i < dimCount; i++) {
    await page.locator(".report-dim-header").nth(i).click();
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000);
  
  // Check product images
  console.log("[9] Checking product images...");
  const products = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".report-product-card")).map((card, i) => {
      const img = card.querySelector("img");
      const nameEl = card.querySelector(".report-product-name");
      const priceEl = card.querySelector(".report-product-price");
      const brandEl = card.querySelector(".report-product-brand");
      return {
        index: i,
        hasImage: !!img,
        imageUrl: img ? img.src : null,
        name: nameEl ? nameEl.textContent.trim() : null,
        price: priceEl ? priceEl.textContent.trim() : null,
        brand: brandEl ? brandEl.textContent.trim() : null,
        link: card.href || null,
      };
    });
  });
  
  console.log("\n=== PRODUCTS (" + products.length + ") ===");
  for (const p of products) {
    console.log("  #" + p.index + ": " + (p.hasImage ? "IMG" : "NO IMG") + " | " + (p.name || "none"));
    if (p.price) console.log("      Price: ¥" + p.price);
    if (p.link) console.log("      Link: " + p.link.substring(0, 80));
  }
  
  // Check image loading status
  console.log("\n=== IMAGE LOAD STATUS ===");
  const imageStatus = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img")).filter(img => {
      return img.className && img.className.includes("product");
    }).map(img => ({
      src: img.src,
      loaded: img.complete && img.naturalWidth > 0,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));
  });
  
  let loaded = 0, broken = 0;
  for (const img of imageStatus) {
    if (img.loaded) loaded++; else broken++;
    console.log("  " + (img.loaded ? "LOADED" : "BROKEN") + ": w=" + img.naturalWidth + " h=" + img.naturalHeight + " | " + img.src.substring(0, 80));
  }
  console.log("\nTotal: " + loaded + " loaded, " + broken + " broken out of " + imageStatus.length);
  
  // Check suspicious products
  console.log("\n=== SUSPICIOUS PRODUCTS (<¥50) ===");
  const suspicious = products.filter(p => {
    const pn = p.price ? parseFloat(p.price.replace(/[¥,]/g, "")) : 0;
    return pn > 0 && pn < 50;
  });
  if (suspicious.length > 0) {
    for (const sp of suspicious) {
      console.log("  ⚠️ " + sp.name + " | ¥" + sp.price + " | img:" + (sp.hasImage ? "yes" : "NO"));
    }
  } else {
    console.log("  None found");
  }
  
  // Save screenshot to file
  const sp = SCREENSHOT_DIR + "/tier2_image_verify_" + Date.now() + ".png";
  await page.screenshot({ path: sp, fullPage: true });
  console.log("\n[Screenshot saved to: " + sp + "]");
  
  // Output JSON summary
  const summary = {
    totalProducts: products.length,
    imagesLoaded: loaded,
    imagesBroken: broken,
    suspiciousProducts: suspicious.map(p => ({ name: p.name, price: p.price, hasImage: p.hasImage })),
    allImages: imageStatus,
    screenshotPath: sp,
  };
  console.log("\n=== JSON SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
  
  await browser.close();
  console.log("\n=== DONE ===");
})();
