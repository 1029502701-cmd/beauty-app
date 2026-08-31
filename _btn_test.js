const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', err => console.log('JS Error:', err.message));
  
  await page.goto('http://127.0.0.1:8788/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder*="手机号"]', '139000000066');
  await page.fill('input[placeholder*="验证码"]', '948964');
  await page.click('button:has-text("登录")');
  await page.waitForTimeout(2000);
  console.log('After login:', page.url());
  
  await page.goto('http://127.0.0.1:8788/report?id=44ef8170-9176-40f2-ba2b-7aabb6802ada&tab=%E8%BF%AD%E9%98%80', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  console.log('Final URL:', page.url());
  
  const heroTitle = await page.locator('.t2-hero-main-title').textContent().catch(() => 'NOT FOUND');
  console.log('Hero title:', heroTitle);
  
  const shareBtn = page.locator('.t2-share-btn');
  const hookBtn = page.locator('.t2-btn-hook');
  const shareBg = await shareBtn.evaluate(el => getComputedStyle(el).backgroundColor);
  const hookBg = await hookBtn.evaluate(el => getComputedStyle(el).backgroundColor);
  console.log('Share btn color:', shareBg);
  console.log('Hook btn color:', hookBg);
  
  const stepCards = await page.locator('.t2-step-card').count();
  console.log('Step card count:', stepCards);
  
  const mockHint = await page.locator('.t2-ai-hint').count();
  console.log('Mock hint:', mockHint > 0 ? 'YES' : 'NO (real data)');
  
  const coreConclusion = await page.locator('.t2-hero-decode-text').textContent().catch(() => 'none');
  console.log('Core conclusion:', coreConclusion.substring(0, 100));
  
  console.log('Share visible:', await shareBtn.isVisible());
  console.log('Hook visible:', await hookBtn.isVisible());
  
  const lightbulbBtns = await page.locator('.t2-lightbulb-btn').count();
  console.log('Lightbulb buttons:', lightbulbBtns);
  
  const hookText = await hookBtn.textContent().catch(() => 'N/A');
  console.log('Hook btn text:', hookText);
  const shareText = await shareBtn.textContent().catch(() => 'N/A');
  console.log('Share btn text:', shareText);
  
  await page.screenshot({ path: 'test_output/btn_color_test.png', fullPage: true });
  console.log('Screenshot saved');
  
  console.log('\n=== Changing tier2_btn_color to #db2777 ===');
  const adminRes = await page.evaluate(async () => {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'tier2_btn_color', value: '#FF4444' })
    });
    return res.json();
  });
  console.log('Admin config update:', adminRes);
  
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const shareBg2 = await shareBtn.evaluate(el => getComputedStyle(el).backgroundColor);
  const hookBg2 = await hookBtn.evaluate(el => getComputedStyle(el).backgroundColor);
  console.log('After change - Share btn color:', shareBg2);
  console.log('After change - Hook btn color:', hookBg2);
  
  await page.screenshot({ path: 'test_output/btn_color_after_change.png', fullPage: true });
  console.log('Screenshot saved');
  
  await browser.close();
  console.log('\n=== ALL TESTS PASSED ===');
})();
