const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
  const tier1Data = JSON.stringify({
    faceShape: "方脸", skinType: "干性肌", eyebrowShape: "平眉", eyeShape: "丹凤眼",
    threeFiveRatio: "上庭偏长", symmetry: "中等对称度",
    personaTags: ["成熟干练", "气场强", "中性风"],
    highlight: "下颌线清晰有棱角，颧骨略高，整体轮廓偏硬朗",
    suggestions: ["柔和眉形可弱化方脸的硬朗感", "干皮需加强保湿底妆避免卡粉", "丹凤眼适合猫眼线加大地色消肿"]
  });
  
  const context = await browser.newContext({
    storageState: {
      origins: [{
        origin: 'http://localhost:8788',
        localStorage: [
          { name: 'session_token', value: 'c3ee30dc-617d-4de2-aab0-cbc74c597c4f' },
          { name: 'has_password', value: 'true' }
        ],
        sessionStorage: [
          { name: 'capture_report_t1-test-007', value: tier1Data }
        ]
      }]
    }
  });
  const page = await context.newPage();
  
  page.on('pageerror', err => console.log('JS Error:', err.message));
  
  console.log('=== Test: Tier2 Share Unlock Flow ===');
  console.log('Step 1: Navigate to report page (tier2 already ready)...');
  await page.goto('http://localhost:8788/report?id=t1-test-007&tab=进阶', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  
  console.log('URL:', page.url());
  
  // Check if content is already visible (tier2 already generated)
  const coreCard = await page.locator('.report-core-card').count();
  const keyAreas = await page.locator('.report-area-text').allTextContents();
  const coreMakeup = await page.locator('.report-core-text').textContent().catch(() => 'none');
  const prodNames = await page.locator('.report-product-name').allTextContents();
  
  console.log('Core cards:', coreCard);
  console.log('Key areas count:', keyAreas.length);
  console.log('Core makeup:', coreMakeup.substring(0, 80));
  console.log('Product recs count:', prodNames.length);
  
  if (coreCard > 0) {
    console.log('SUCCESS! Tier2 content is already visible.');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\pw_share_final_ready.png', fullPage: true });
    
    // Verify key content
    console.log('\n=== Content Verification ===');
    console.log('Core makeup:', coreMakeup);
    console.log('Key areas:', keyAreas.length, 'items');
    keyAreas.slice(0, 3).forEach((a, i) => console.log(`  Area ${i+1}:`, a.substring(0, 60)));
  } else {
    console.log('FAILED: No content found');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\pw_share_final_fail.png', fullPage: true });
  }
  
  await browser.close();
  console.log('\nDone');
})();