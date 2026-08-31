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
  
  // Step 1: Register
  console.log('=== Register ===');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const phone = '139' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  const password = 'TestImg' + Date.now();
  
  await page.fill('input[placeholder*="手机"]', phone);
  await page.fill('input[placeholder*="密码"]', password);
  await page.fill('input[placeholder*="再次"]', password);
  await page.click('button.login-btn');
  await page.waitForTimeout(2000);
  console.log('Logged in, URL:', page.url());
  
  const token = await page.evaluate(() => localStorage.getItem('session_token'));
  
  // Step 2: Go to capture page and upload photo
  console.log('\n=== Upload photo ===');
  await page.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles(PHOTO_PATH);
  console.log('Photo uploaded, waiting for analysis...');
  
  await page.waitForSelector('.capture-done, .capture-error', { timeout: 70000 });
  await page.waitForTimeout(2000);
  
  const stage = await page.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-error')) return 'error';
    return 'analyzing';
  });
  console.log('Analysis stage:', stage);
  
  if (stage !== 'done') {
    console.log('Analysis failed!');
    await page.screenshot({ path: SCREENSHOT_DIR + '/tier2_capture_error.png' });
    await browser.close();
    return;
  }
  
  // Click view report
  await page.click('.capture-view-report-btn');
  await page.waitForTimeout(3000);
  console.log('After click, URL:', page.url());
  
  // Step 3: Expand dimension sections
  console.log('\n=== Check tier2 report ===');
  await page.waitForTimeout(2000);
  
  const hasTier2 = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('推荐产品') || text.includes('AI 妆效');
  });
  console.log('Has tier2 content:', hasTier2);
  
  const dimHeaders = await page.locator('.report-dim-header').count();
  console.log('Dimension headers:', dimHeaders);
  
  for (let i = 0; i < dimHeaders; i++) {
    const btn = page.locator('.report-dim-header').nth(i);
    const text = await btn.textContent();
    console.log('Expanding:', text.substring(0, 30));
    await btn.click();
    await page.waitForTimeout(300);
  }
  
  await page.waitForTimeout(1000);
  
  // Screenshot
  await page.screenshot({ path: SCREENSHOT_DIR + '/tier2_verify_full.png', fullPage: true });
  console.log('Screenshot saved');
  
  // Check products
  const products = await page.evaluate(() => {
    const cards = document.querySelectorAll('.report-product-card');
    return Array.from(cards).map((card, i) => {
      const img = card.querySelector('img');
      const nameEl = card.querySelector('.report-product-name');
      const priceEl = card.querySelector('.report-product-price');
      const brandEl = card.querySelector('.report-product-brand');
      return {
        index: i,
        hasImage: !!img,
        imageUrl: img ? img.src : null,
        name: nameEl ? nameEl.textContent.trim() : null,
        price: priceEl ? priceEl.textContent.trim() : null,
        brand: brandEl ? brandEl.textContent.trim() : null,
        link: card.href || null,
      };
    });
  });
  
  console.log('\n=== Products (' + products.length + ') ===');
  for (const p of products) {
    console.log('  #' + p.index + ': ' + (p.hasImage ? 'IMG OK' : 'IMG MISSING') + ' | ' + (p.name||'') + ' | ' + (p.price||'') + ' | ' + (p.brand||''));
  }
  
  // Check image load status
  const imageStatus = await page.evaluate(() => {
    const imgs = document.querySelectorAll('.report-product-img');
    return Array.from(imgs).map(img => ({
      src: img.src.substring(0, 60),
      naturalWidth: img.naturalWidth,
      complete: img.complete,
    }));
  });
  
  console.log('\n=== Image status ===');
  let loaded = 0, broken = 0;
  for (const img of imageStatus) {
    const status = img.naturalWidth > 0 ? 'LOADED' : 'BROKEN';
    if (img.naturalWidth > 0) loaded++; else broken++;
    console.log('  ' + status + ': ' + img.src);
  }
  console.log('Total: ' + loaded + ' loaded, ' + broken + ' broken');
  
  // Check for suspicious low-priced products
  const suspicious = products.filter(p => {
    const priceNum = p.price ? parseFloat(p.price.replace(/[¥,]/g, '')) : 0;
    return priceNum > 0 && priceNum < 50;
  });
  
  if (suspicious.length > 0) {
    console.log('\n⚠️ SUSPICIOUS LOW-PRICED PRODUCTS (<¥50):');
    for (const sp of suspicious) {
      console.log('  ' + sp.name + ' | ' + sp.price + ' | img:' + (sp.hasImage ? 'yes' : 'NO'));
    }
  } else {
    console.log('\n✅ No suspicious low-priced products (<¥50)');
  }
  
  await browser.close();
  console.log('\n=== Done ===');
})();
