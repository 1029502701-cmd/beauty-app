const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const tier1Data = JSON.stringify({
    faceShape: "心形脸", skinType: "敏感肌", eyebrowShape: "拱形眉", eyeShape: "圆眼",
    threeFiveRatio: "中庭偏短", symmetry: "高对称度",
    personaTags: ["甜美可爱", "少女感", "清新自然"],
    highlight: "额头较宽下巴尖，苹果肌饱满",
    suggestions: ["低拱眉更配心形脸的柔和感", "敏感肌优先用矿物彩妆", "圆眼适合下垂眼线"]
  });
  
  // Register via API
  const regRes = await page.evaluate(async () => {
    const r = await fetch('http://localhost:8788/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13900000008', password: 'TestPass1', confirmPassword: 'TestPass1' })
    });
    return await r.json();
  });
  console.log('Register:', regRes);
  
  // Login
  const loginRes = await page.evaluate(async () => {
    const r = await fetch('http://localhost:8788/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13900000008', password: 'TestPass1' })
    });
    return await r.json();
  });
  console.log('Login:', loginRes);
  
  const token = loginRes.sessionId;
  
  // Create tier1 and tier2 records via API
  await page.evaluate(async (token, tier1Data) => {
    // Insert tier1 report
    await fetch('http://localhost:8788/api/test/insert-tier1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ tier1Data })
    });
  }, token, tier1Data);
  
  await browser.close();
  
  // Now test the full flow
  const browser2 = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser2.newContext({
    storageState: {
      origins: [{
        origin: 'http://localhost:8788',
        localStorage: [
          { name: 'session_token', value: token },
          { name: 'has_password', value: 'true' }
        ],
        sessionStorage: [
          { name: 'capture_report_t1-test-008', value: tier1Data }
        ]
      }]
    }
  });
  const page2 = await context.newPage();
  
  page2.on('pageerror', err => console.log('JS Error:', err.message));
  
  console.log('\n=== Test: Fresh Share Unlock Flow ===');
  await page2.goto('http://localhost:8788/report?id=t1-test-008&tab=进阶', { waitUntil: 'networkidle', timeout: 15000 });
  await page2.waitForTimeout(3000);
  
  const unlockBtn = page2.locator('button:has-text("分享解锁")').first();
  if (await unlockBtn.count() > 0) {
    console.log('Clicking share unlock...');
    await unlockBtn.click();
    await page2.waitForTimeout(2000);
    
    const loadingText = await page2.locator('.report-loading p').textContent().catch(() => 'none');
    console.log('Loading:', loadingText);
    
    console.log('Waiting for content...');
    try {
      await page2.waitForSelector('.report-core-card', { timeout: 90000 });
      console.log('SUCCESS!');
      await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\pw_share_fresh_ready.png', fullPage: true });
      
      const keyAreas = await page2.locator('.report-area-text').allTextContents();
      console.log('Key areas:', keyAreas.length);
    } catch (e) {
      console.log('Timeout:', e.message);
      await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\pw_share_fresh_timeout.png', fullPage: true });
    }
  } else {
    const coreCard = await page2.locator('.report-core-card').count();
    console.log('Core cards:', coreCard);
    if (coreCard > 0) {
      await page2.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\pw_share_fresh_already.png', fullPage: true });
    }
  }
  
  await browser2.close();
  console.log('Done');
})();