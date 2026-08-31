const { chromium } = require('playwright');
const BASE = 'https://beauty-api-pages.pages.dev';
const SCREENSHOT_DIR = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output';
const PHOTO_PATH = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text().substring(0, 120)));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message.substring(0, 100)));
  
  // Register
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const phone = '139' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  const password = 'TestImg' + Date.now();
  
  await page.fill('input[placeholder*="手机"]', phone);
  await page.fill('input[placeholder*="密码"]', password);
  await page.fill('input[placeholder*="再次"]', password);
  await page.click('button.login-btn');
  await page.waitForTimeout(2000);
  
  const token = await page.evaluate(() => localStorage.getItem('session_token'));
  console.log('Token:', token ? token.substring(0,20) : 'NONE');
  
  // Upload photo
  await page.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(PHOTO_PATH);
  await page.waitForSelector('.capture-done, .capture-error', { timeout: 70000 });
  await page.waitForTimeout(2000);
  
  const stage = await page.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-error')) return 'error';
    return 'analyzing';
  });
  console.log('Stage:', stage);
  
  // Get reports
  const reportData = await page.evaluate(async (token) => {
    const res = await fetch('/api/reports/mine', { headers: { Authorization: 'Bearer ' + token } });
    return await res.json();
  }, token);
  console.log('Reports count:', Array.isArray(reportData) ? reportData.length : 'not array');
  
  const reports = Array.isArray(reportData) ? reportData : [];
  const tier1Report = reports.find(r => r.type === 'tier1' || !r.type);
  if (!tier1Report) { console.log('No tier1 found'); await browser.close(); return; }
  
  const reportId = tier1Report.id;
  console.log('Tier1 ID:', reportId);
  
  // Trigger tier2
  console.log('\n=== Triggering tier2 ===');
  const genRes = await page.evaluate(async (rid, tok) => {
    const res = await fetch('/api/tier2/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ reportId: rid }),
    });
    return await res.json();
  }, reportId, token);
  console.log('Gen response:', JSON.stringify(genRes));
  
  // Poll
  console.log('\n=== Polling tier2 ===');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(3000);
    const statusRes = await page.evaluate(async (rid, tok) => {
      const res = await fetch('/api/tier2/status?tier1ReportId=' + rid, { headers: { Authorization: 'Bearer ' + tok } });
      return await res.json();
    }, reportId, token);
    console.log('  [' + (i+1) + '] ' + statusRes.generationStatus);
    if (statusRes.generationStatus === 'ready') { console.log('READY!'); break; }
    if (statusRes.generationStatus === 'failed') { console.log('FAILED'); break; }
  }
  
  // Navigate to report
  await page.goto(BASE + '/report', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const hasTier2 = await page.evaluate(() => document.body.innerText.includes('推荐产品'));
  console.log('\nHas tier2:', hasTier2);
  
  // Expand dims
  const dimCount = await page.locator('.report-dim-header').count();
  console.log('Dim headers:', dimCount);
  for (let i = 0; i < dimCount; i++) {
    await page.locator('.report-dim-header').nth(i).click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);
  
  await page.screenshot({ path: SCREENSHOT_DIR + '/tier2_deployed_verify.png', fullPage: true });
  console.log('Screenshot saved');
  
  // Products
  const products = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.report-product-card')).map((card, i) => {
      const img = card.querySelector('img');
      const nameEl = card.querySelector('.report-product-name');
      const priceEl = card.querySelector('.report-product-price');
      const brandEl = card.querySelector('.report-product-brand');
      return { index: i, hasImage: !!img, imageUrl: img ? img.src : null, name: nameEl ? nameEl.textContent.trim() : null, price: priceEl ? priceEl.textContent.trim() : null, brand: brandEl ? brandEl.textContent.trim() : null, link: card.href || null };
    });
  });
  
  console.log('\n=== Products (' + products.length + ') ===');
  for (const p of products) {
    console.log('  #' + p.index + ': ' + (p.hasImage ? 'IMG OK' : 'IMG MISSING') + ' | ' + (p.name||'') + ' | ' + (p.price||'') + ' | ' + (p.brand||''));
  }
  
  const imageStatus = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.report-product-img')).map(img => ({ src: img.src.substring(0,60), w: img.naturalWidth, done: img.complete }));
  });
  let loaded = 0, broken = 0;
  for (const img of imageStatus) { if (img.w > 0) loaded++; else broken++; console.log('  ' + (img.w > 0 ? 'LOADED' : 'BROKEN') + ': ' + img.src); }
  console.log('Total: ' + loaded + ' loaded, ' + broken + ' broken');
  
  const suspicious = products.filter(p => { const pn = p.price ? parseFloat(p.price.replace(/[¥,]/g,'')) : 0; return pn > 0 && pn < 50; });
  if (suspicious.length > 0) { console.log('\n⚠️ SUSPICIOUS (<¥50):'); suspicious.forEach(sp => console.log('  ' + sp.name + ' | ' + sp.price)); }
  else { console.log('\n✅ No suspicious products'); }
  
  await browser.close();
  console.log('\n=== Done ===');
})();
