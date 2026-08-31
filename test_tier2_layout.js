const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const BASE = 'http://127.0.0.1:8788';
  const SCREENSHOT_DIR = path.join(__dirname, 'test_output');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text().substring(0, 100)));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message.substring(0, 100)));

  // Login via API
  console.log('[1] Logging in...');
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '1390000001', password: 'Test1234' })
  });
  const loginData = await loginRes.json();
  console.log('Login response:', loginData);
  
  if (loginData.sessionId) {
    await page.goto(BASE + '/tier2-result', { waitUntil: 'networkidle' });
    await page.evaluate((token) => {
      localStorage.setItem('session_token', token);
    }, loginData.sessionId);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('URL:', page.url());
    
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tier2_layout_preview.png'), fullPage: true });
    console.log('[2] Screenshot saved');
    
    // Check elements
    const checks = ['.t2-page', '.t2-card', '.t2-hero-title', '.t2-tier3-hook', '.t2-share-btn', '.t2-card-corner', '.t2-dim-header'];
    for (const sel of checks) {
      const count = await page.locator(sel).count();
      console.log(`${sel}: ${count > 0 ? '✓' : '✗'} (${count})`);
    }
    
    const heroTitle = await page.locator('.t2-hero-title').textContent().catch(() => null);
    console.log('\n[3] Hero title:', heroTitle);
    
    const dimTitles = await page.locator('.t2-dim-title').allTextContents();
    console.log('[4] Dimension titles:', dimTitles.slice(0, 3));
    
    const productCards = await page.locator('.t2-product-card').count();
    console.log('[5] Product cards:', productCards);
    
    const hookText = await page.locator('.t2-tier3-hook-text').textContent().catch(() => null);
    console.log('[6] Tier3 hook text:', hookText);
    
    const lightbulbs = await page.locator('.t2-lightbulb-btn').count();
    console.log('[7] Lightbulb buttons:', lightbulbs);
  } else {
    console.log('Login failed:', loginData);
  }
  
  await browser.close();
  console.log('\n=== Done ===');
})();