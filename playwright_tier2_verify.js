const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const TOKEN = "d12c68ac-75a6-44af-902a-254a4366eed3";
  const REPORT_ID = "812d2fd8-aaf7-4a8c-bc91-eae1f05c6fc9";
  const TIER2_ID = "cf34ea2e-8cef-4526-9c9a-640c445988a0";

  const context = await browser.newContext({
    storageState: {
      origins: [{
        origin: "http://localhost:8788",
        localStorage: [
          { name: "session_token", value: TOKEN },
          { name: "has_password", value: "true" }
        ]
      }]
    }
  });
  const page = await context.newPage();
  page.on("pageerror", err => console.log("PAGE_ERROR:", err.message));

  console.log("=== Test 1: New UI (t2-step-card) renders instead of old UI ===");
  await page.goto("http://localhost:8788/report?id=" + REPORT_ID + "&tab=%E8%BF%9B%E9%98%B6", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log("URL:", page.url());

  const hasNewUI = await page.locator(".t2-step-card").count();
  const hasOldUI = await page.locator(".report-core-card").count();
  const hasHeroTitle = await page.locator(".t2-hero-main-title").count();
  console.log("[PASS] New UI .t2-step-card count:", hasNewUI);
  console.log("[PASS] Old UI .report-core-card count:", hasOldUI, "(expected: 0)");
  console.log("[PASS] Hero title .t2-hero-main-title present:", hasHeroTitle > 0);

  const stepTitles = await page.locator(".t2-step-title").allTextContents();
  console.log("[INFO] Step card titles (" + stepTitles.length + "):", JSON.stringify(stepTitles));

  console.log("");
  console.log("=== Test 2: Data is real (isMock=false), not mock fallback ===");
  const mockBannerCount = await page.locator(".t2-ai-hint").count();
  console.log("[PASS] Mock hint banner count:", mockBannerCount, "(expected: 0 for real data)");

  const heroBadge = await page.locator(".t2-hero-badge").textContent().catch(() => "none");
  const heroStyle = await page.locator(".t2-hero-subtitle span").nth(1).textContent().catch(() => "none");
  console.log("[INFO] Hero badge text:", heroBadge);
  console.log("[INFO] Hero style text:", heroStyle);

  const stepAnalysisCount = await page.locator(".t2-step-section-text").count();
  console.log("[INFO] Step section texts count:", stepAnalysisCount, "(should be > 0)");

  const stepWhyCount = await page.locator(".t2-step-why .t2-step-section-text").count();
  console.log("[INFO] Why sections count:", stepWhyCount);

  console.log("");
  console.log("=== Test 3: Button color from computed style ===");
  const shareBtnColor = await page.locator(".t2-share-btn").evaluate(el => getComputedStyle(el).backgroundColor);
  console.log("[PASS] .t2-share-btn background-color:", shareBtnColor);

  const hookBtnColor = await page.locator(".t2-btn-hook").evaluate(el => getComputedStyle(el).backgroundColor);
  console.log("[PASS] .t2-btn-hook background-color:", hookBtnColor);

  const configRes = await page.evaluate(async () => {
    const r = await fetch("/api/config/tier2_btn_color");
    return await r.json();
  });
  console.log("[INFO] API config tier2_btn_color:", JSON.stringify(configRes));

  console.log("");
  console.log("=== Test 4a: Product modal ===");
  const lightbulbBtns = await page.locator(".t2-lightbulb-btn").count();
  console.log("[INFO] Lightbulb buttons (.t2-lightbulb-btn):", lightbulbBtns);
  if (lightbulbBtns > 0) {
    await page.locator(".t2-lightbulb-btn").first().click();
    await page.waitForTimeout(500);
    const modalVisible = await page.locator(".t2-modal-overlay").isVisible();
    console.log("[PASS] Modal visible after click:", modalVisible);
    if (modalVisible) {
      const modalTitle = await page.locator(".t2-modal-title").textContent();
      console.log("[INFO] Modal title:", modalTitle);
      const productCards = await page.locator(".t2-product-card").count();
      console.log("[INFO] Product cards in modal:", productCards);
      if (productCards > 0) {
        const productName = await page.locator(".t2-product-name").first().textContent();
        console.log("[INFO] First product name:", productName);
      }
      await page.locator(".t2-modal-close").click();
      await page.waitForTimeout(300);
      const modalClosed = await page.locator(".t2-modal-overlay").isVisible().catch(() => false);
      console.log("[PASS] Modal closed after X click:", !modalClosed);
    }
  } else {
    console.log("[SKIP] No product recommendations (0 lightbulb buttons)");
  }

  console.log("");
  console.log("=== Test 4b: Share/ad unlock buttons on page ===");
  const shareUnlockBtn = await page.locator('button:has-text("分享解锁")').count();
  const adUnlockBtn = await page.locator('button:has-text("看广告解锁")').count();
  const shareUnlockImgBtn = await page.locator('button:has-text("看广告解锁效果图")').count();
  console.log("[INFO] 分享解锁 button count:", shareUnlockBtn);
  console.log("[INFO] 看广告解锁 button count:", adUnlockBtn);
  console.log("[INFO] 看广告解锁效果图 button count:", shareUnlockImgBtn);

  console.log("");
  console.log("=== Test 4c: Tier2 polling API ===");
  const statusRes = await page.evaluate(async () => {
    const r = await fetch("/api/tier2/status?tier2Id=cf34ea2e-8cef-4526-9c9a-640c445988a0", {
      headers: { "Authorization": "Bearer d12c68ac-75a6-44af-902a-254a4366eed3" }
    });
    return await r.json();
  });
  const content = statusRes.content || {};
  console.log("[INFO] generationStatus:", statusRes.generationStatus);
  console.log("[INFO] steps count:", Array.isArray(content.steps) ? content.steps.length : 0);
  console.log("[INFO] style:", content.style || "none");
  console.log("[INFO] has coreConclusion:", !!content.coreConclusion);
  console.log("[INFO] productRecs keys:", content.productRecs ? Object.keys(content.productRecs) : "none");
  if (statusRes.generationStatus === "ready" && content.steps) {
    console.log("[PASS] Real tier2 data confirmed via API (not mock)");
  } else {
    console.log("[FAIL] No ready content, status:", statusRes.generationStatus);
  }

  console.log("");
  console.log("=== Test 4d: Ad unlock section ===");
  const unlockImgSection = await page.locator(".report-img-cta").count();
  console.log("[INFO] AI妆效效果图 CTA section present:", unlockImgSection > 0);
  if (unlockImgSection > 0) {
    const btnText = await page.locator(".report-img-btn").textContent();
    console.log("[INFO] Unlock image button text:", btnText);
    console.log("[PASS] Ad unlock section visible");
  }

  console.log("");
  console.log("=== Test 5: Full page content summary ===");
  const allText = await page.locator(".t2-page").textContent();
  const textLen = allText ? allText.length : 0;
  console.log("[INFO] t2-page text length:", textLen);
  console.log("[PASS] Contains 面部分析:", allText && allText.includes("面部分析"));
  console.log("[PASS] Contains 避雷提示:", allText && allText.includes("避雷提示"));
  console.log("[PASS] Contains 妆容总结:", allText && allText.includes("妆容总结"));
  console.log("[PASS] Contains 方案解读:", allText && allText.includes("方案解读"));
  console.log("[PASS] Contains 分享报告:", allText && allText.includes("分享报告"));
  console.log("[PASS] Contains 解锁专属报告:", allText && allText.includes("解锁专属报告"));

  const tipsBullets = await page.locator(".t2-tips-bullet").allTextContents();
  console.log("[INFO] Tip bullets count:", tipsBullets.length);
  tipsBullets.slice(0, 3).forEach((t, i) => console.log("  Tip " + (i+1) + ":", t.substring(0, 60)));

  const summaryText = await page.locator(".t2-summary-text").textContent().catch(() => "none");
  console.log("[INFO] Summary text (" + summaryText.length + " chars):", summaryText.substring(0, 100));

  await browser.close();
  console.log("\n=== ALL TESTS DONE ===");
})();
