const { chromium } = require('playwright');
const BASE = 'https://beauty-api-pages.pages.dev';
const SCREENSHOT_DIR = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output';

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
  
  await page.fill('input[placeholder*=\"手机\"]', phone);
  await page.fill('input[placeholder*=\"密码\"]', password);
  await page.fill('input[placeholder*=\"再次\"]', password);
  await page.click('button.login-btn');
  await page.waitForTimeout(2000);
  
  const token = await page.evaluate(() => localStorage.getItem('session_token'));
  console.log('Token:', token ? token.substring(0,20) : 'NONE');
  
  // Upload photo for tier1
  await page.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const fileInput = await page.locator('input[type=\"file\"]');
  await fileInput.setInputFiles('C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg');
  await page.waitForSelector('.capture-done, .capture-error', { timeout: 70000 });
  await page.waitForTimeout(2000);
  
  const stage = await page.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-error')) return 'error';
    return 'analyzing';
  });
  console.log('Stage:', stage);
  
  const reportId = await page.evaluate(() => sessionStorage.getItem('capture_report_id'));
  console.log('Report ID:', reportId);
  
  // Trigger tier2 via share endpoint (which creates the tier2 record)
  console.log('\\n=== Triggering tier2 via share ===');
  const shareRes = await page.evaluate(({ rid, tok }) => fetch('/api/tier1/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: JSON.stringify({ reportId: rid }),
  }).then(r => r.json()).catch(e => ({error: e.message})), { rid: reportId, tok: token });
  console.log('Share response:', JSON.stringify(shareRes).substring(0, 200));
  
  // Poll for tier2 completion
  const tier2Id = shareRes.tier2ReportId;
  if (tier2Id) {
    console.log('\\n=== Polling tier2 (id: ' + tier2Id.substring(0,8) + ') ===');
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(3000);
      const statusRes = await page.evaluate(({ tid, tok }) => fetch('/api/tier2/status?tier2Id=' + tid, {
        headers: { Authorization: 'Bearer ' + tok }
      }).then(r => r.json()).catch(e => ({error: e.message})), { tid: tier2Id, tok: token });
      console.log('  [' + (i+1) + '] ' + statusRes.generationStatus + (statusRes.content ? ' content=yes' : ''));
      if (statusRes.generationStatus === 'ready') { console.log('READY!'); break; }
      if (statusRes.generationStatus === 'failed') { console.log('FAILED'); break; }
    }
  } else {
    console.log('No tier2ReportId in share response');
  }
  
  // Navigate to report
  await page.evaluate(({ rid }) => {
    window.history.pushState({ reportId: rid }, '', '/report');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, { rid: reportId });
  await page.waitForTimeout(3000);
  
  // Click 进阶 tab
  const tabs = await page.locator('.report-tab').all();
  for (const tab of tabs) {
    const text = await tab.textContent();
    if (text.includes('进阶')) {
      await tab.click();
      await page.waitForTimeout(2000);
      break;
    }
  }
  
  // Expand dims
  const dimCount = await page.locator('.report-dim-header').count();
  console.log('\\nDim headers:', dimCount);
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
    console.log('  #' + p.index + ': ' + (p.hasImage ? 'IMG OK' : 'IMG MISSING') + ' | ' + (p.name||'') + ' | ' + (p.price||'') + ' | ' + (p.brand||''));
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
  
  // Check for SK-II and 眉粉
  const skincareProducts = products.filter(p => {
    const name = (p.name || '').toLowerCase();
    return name.includes('sk') || name.includes('神仙水') || name.includes('肌因') || name.includes('眉粉') || name.includes('brow');
  });
  if (skincareProducts.length > 0) {
    console.log('\\n=== SK-II / 眉粉 products found ===');
    skincareProducts.forEach(sp => console.log('  ' + sp.name + ' | ' + sp.price + ' | img:' + (sp.hasImage ? 'yes' : 'NO')));
  } else {
    console.log('\\nNo SK-II or 眉粉 products in this report');
  }
  
  // Suspicious check
  const suspicious = products.filter(p => {
    const pn = p.price ? parseFloat(p.price.replace(/[¥,]/g,'')) : 0;
    return pn > 0 && pn < 50;
  });
  if (suspicious.length > 0) {
    console.log('\\n⚠️ SUSPICIOUS (<¥50):');
    suspicious.forEach(sp => console.log('  ' + sp.name + ' | ' + sp.price + ' | img:' + (sp.hasImage ? 'yes' : 'NO')));
  } else {
    console.log('\\n✅ No suspicious products (<¥50)');
  }
  
  await browser.close();
  console.log('\\n=== Done ===');
})();
