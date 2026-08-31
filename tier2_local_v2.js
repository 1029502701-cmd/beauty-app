const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8788';
const SCREENSHOT_DIR = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text().substring(0, 120)));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message.substring(0, 100)));
  
  // Login
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.fill('input[placeholder*="手机"]', '13800000001');
  await page.fill('input[placeholder*="密码"]', 'test1234');
  await page.fill('input[placeholder*="再次"]', 'test1234');
  await page.click('button.login-btn');
  await page.waitForTimeout(1500);
  const token = await page.evaluate(() => localStorage.getItem('session_token'));
  console.log('Token:', token ? token.substring(0,20) : 'NONE');
  
  const tier1Id = '4db4ae4c-cb25-4bb2-9ff0-8f912898ce21';
  
  // Fetch tier1 report directly from API
  const tier1Resp = await page.evaluate(({ rid, tok }) => fetch('/api/reports/tier1/' + rid, {
    headers: { Authorization: 'Bearer ' + tok }
  }).then(r => r.json()).catch(e => ({error: e.message})), { rid: tier1Id, tok: token });
  console.log('Tier1 API response:', JSON.stringify(tier1Resp).substring(0, 200));
  
  // Store in sessionStorage
  if (tier1Resp && tier1Resp.report) {
    await page.evaluate(({ rid, data }) => {
      sessionStorage.setItem('capture_report_' + rid, JSON.stringify(data));
    }, { rid: tier1Id, data: tier1Resp.report });
    console.log('Stored tier1 in sessionStorage');
  }
  
  // Navigate
  await page.evaluate(({ rid }) => {
    window.history.pushState({ reportId: rid }, '', '/report');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, { rid: tier1Id });
  await page.waitForTimeout(3000);
  
  console.log('URL:', page.url());
  
  // Check page state
  const pageState = await page.evaluate(() => {
    return {
      hasProductRecs: document.body.innerText.includes('推荐产品'),
      hasDimHeader: document.querySelector('.report-dim-header') !== null,
      textPreview: document.body.innerText.substring(0, 300),
    };
  });
  console.log('Page state:', JSON.stringify(pageState));
  
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
  
  console.log('\n=== Products (' + products.length + ') ===');
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
    console.log('\n⚠️ SUSPICIOUS (<¥50):');
    suspicious.forEach(sp => console.log('  ' + sp.name + ' | ¥' + sp.price + ' | img:' + (sp.hasImage ? 'yes' : 'NO')));
  } else {
    console.log('\n✅ No suspicious products (<¥50)');
  }
  
  await browser.close();
  console.log('\n=== Done ===');
})();
