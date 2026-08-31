const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const token = '89066595-93f5-432b-b759-6f625e1d713a';
  await page.addInitScript((t) => {
    localStorage.setItem('session_token', t);
    sessionStorage.setItem('session_token', t);
  }, token);
  
  console.log('Navigate to report...');
  await page.goto('http://localhost:8788/report?id=115e3319-9237-4ee6-ad3f-3b6e7343e364&tab=' + unescape('%E8%BF%AD%E9%98%80'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());
  
  if (page.url().includes('set-password')) {
    console.log('Setting password...');
    await page.fill('input[type=password]', 'test123456');
    await page.locator('button:has-text(\'保存\')').first().click();
    await page.waitForTimeout(2000);
    await page.goto('http://localhost:8788/report?id=115e3319-9237-4ee6-ad3f-3b6e7343e364&tab=' + unescape('%E8%BF%AD%E9%98%80'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
  }
  
  console.log('Final URL:', page.url());
  await page.screenshot({ path: 'pw_1_start.png' });
  
  if (!page.url().includes('report')) {
    console.log('Not on report page');
    await browser.close();
    return;
  }
  
  const unlockBtn = page.locator('button:has-text(\'分享解锁\')').first();
  const unlockCount = await unlockBtn.count();
  const contentCount = await page.locator('.report-core-card').count();
  console.log('Unlock buttons:', unlockCount, 'Content:', contentCount);
  
  if (unlockCount > 0) {
    console.log('Clicking share unlock...');
    await unlockBtn.click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'pw_2_share.png' });
    
    const loadingText = await page.locator('.report-loading p').textContent().catch(() => 'none');
    console.log('Loading text:', loadingText);
    
    console.log('Waiting for generation (max 60s)...');
    try {
      await page.waitForSelector('.report-core-card', { timeout: 60000 });
      console.log('SUCCESS!');
      await page.screenshot({ path: 'pw_3_ready.png' });
      
      const keyAreas = await page.locator('.report-area-text').allTextContents();
      const prodNames = await page.locator('.report-product-name').allTextContents();
      console.log('Key areas:', keyAreas.length);
      console.log('Products:', prodNames.length);
    } catch {
      console.log('Timeout');
      await page.screenshot({ path: 'pw_3_timeout.png' });
    }
  } else if (contentCount > 0) {
    console.log('Content already visible!');
    await page.screenshot({ path: 'pw_1_ready.png' });
  } else {
    console.log('Unexpected state');
    await page.screenshot({ path: 'pw_1_unknown.png' });
  }
  
  await browser.close();
  console.log('Done');
})();
