const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8788';
const SCREENSHOT_DIR = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text().substring(0, 120)));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message.substring(0, 100)));
  
  // Login as user who owns the enriched tier2 report
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const phone = '13800000001';
  const passwords = ['TestPass1', 'test1234', 'Password1', 'Test123456'];
  let token = null;
  for (const pw of passwords) {
    await page.fill('input[placeholder*=\"手机\"]', phone);
    await page.fill('input[placeholder*=\"密码\"]', pw);
    await page.fill('input[placeholder*=\"再次\"]', pw);
    await page.click('button.login-btn');
    await page.waitForTimeout(1000);
    token = await page.evaluate(() => localStorage.getItem('session_token'));
    if (token) { console.log('Logged in with:', pw); break; }
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
  }
  
  if (!token) {
    const newPhone = '139' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
    const newPw = 'TestImg' + Date.now();
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.fill('input[placeholder*=\"手机\"]', newPhone);
    await page.fill('input[placeholder*=\"密码\"]', newPw);
    await page.fill('input[placeholder*=\"再次\"]', newPw);
    await page.click('button.login-btn');
    await page.waitForTimeout(1000);
    token = await page.evaluate(() => localStorage.getItem('session_token'));
    console.log('Registered, token:', token ? token.substring(0,20) : 'NONE');
  }
  
  console.log('Token:', token ? token.substring(0,20) : 'NONE');
  
  // Navigate to report with the tier1 report ID that has enriched tier2 data
  const tier1Id = '4db4ae4c-cb25-4bb2-9ff0-8f912898ce21';
  await page.evaluate(({ rid }) => {
    window.history.pushState({ reportId: rid }, '', '/report');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, { rid: tier1Id });
  await page.waitForTimeout(3000);
  
  console.log('URL:', page.url());
  
  // Check tier2 status
  const t2Status = await page.evaluate(({ tid, tok }) => fetch('/api/tier2/status?tier2Id=' + tid, {
    headers: { Authorization: 'Bearer ' + tok }
  }).then(r => r.json()), { tid: 'c25437d5-526a-4af7-baec-33694aa76825', tok: token });
  console.log('Tier2 status:', JSON.stringify(t2Status).substring(0, 200));
  
  // Expand dims
  const dimCount = await page.locator('.report-dim-header').count();
  console.log('Dim headers:', dimCount);
  for (let i = 0; i < dimCount; i++) {
    await page.locator('.report-dim-header').nth(i).click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);
  
  await page.screenshot({ path: SCREENSHOT_DIR + '/tier2_local_full.png', fullPage: true });
  console.log('Screenshot saved');
  
  // Products
  const products = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.report-product-card')).map((card, i) => {
      const img = card.querySelector('img');
      const nameEl = card.querySelector('.report-product-name');
      const priceEl = card.querySelector('.report-product-price');
      const brandEl = card.querySelector('.report-product-brand');
      return {
        index: i, hasImage: !!img, imageUrl: img ? img.src : null,
        name: nameEl ? nameEl.textContent.trim() : null,
        price: priceEl ? priceEl.textContent.trim() : null,
        brand: brandEl ? brandEl.textContent.trim() : null,
        link: card.href || null,
      };
    });
  });
  
  console.log('\\n=== Products (' + products.length + ') ===');
  for (const p of products) {
    console.log('  #' + p.index + ': ' + (p.hasImage ? 'IMG OK' : 'IMG MISSING') + ' | ' + (p.name||'') + ' | ¥' + (p.price||'?') + ' | ' + (p.brand||''));
  }
  
  const imageStatus = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.report-product-img')).map(img => ({
      src: img.src.substring(0, 60), naturalWidth: img.naturalWidth
    }));
  });
  let loaded = 0, broken = 0;
  for (const img of imageStatus) {
    if (img.naturalWidth > 0) loaded++; else broken++;
    console.log('  ' + (img.naturalWidth > 0 ? 'LOADED' : 'BROKEN') + ': ' + img.src);
  }
  console.log('Total: ' + loaded + ' loaded, ' + broken + ' broken');
  
  const suspicious = products.filter(p => {
    const pn = p.price ? parseFloat(p.price.replace(/[¥,]/g,'')) : 0;
    return pn > 0 && pn < 50;
  });
  if (suspicious.length > 0) {
    console.log('\\n⚠️ SUSPICIOUS (<¥50):');
    suspicious.forEach(sp => console.log('  ' + sp.name + ' | ¥' + sp.price + ' | img:' + (sp.hasImage ? 'yes' : 'NO')));
  } else {
    console.log('\\n✅ No suspicious products (<¥50)');
  }
  
  await browser.close();
  console.log('\\n=== Done ===');
})();
