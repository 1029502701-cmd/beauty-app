const { chromium } = require('playwright');
const BASE = 'https://beauty-api-pages.pages.dev';
const SCREENSHOT_DIR = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output';

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text().substring(0, 120)));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message.substring(0, 100)));
  
  console.log('=== Step 1: Register ===');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const phone = '139' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  const password = 'TestImg' + Date.now();
  
  await page.fill('input[placeholder*="手机"]', phone);
  await page.fill('input[placeholder*="密码"]', password);
  await page.fill('input[placeholder*="再次"]', password);
  await page.click('button.login-btn');
  await page.waitForTimeout(2000);
  console.log('After register, URL:', page.url());
  
  const token = await page.evaluate(() => localStorage.getItem('session_token'));
  console.log('Session token:', token ? token.substring(0, 20) + '...' : 'NOT FOUND');
  
  // Step 2: Navigate to report page
  console.log('\n=== Step 2: Navigate to /report ===');
  await page.goto(BASE + '/report', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  const allText = await page.evaluate(() => document.body.innerText);
  console.log('Page has tier2 content:', allText.includes('推荐产品') || allText.includes('AI 妆效'));
  
  // Look for report cards to click
  const reportLinks = await page.locator('a').all();
  console.log('Total links on page:', reportLinks.length);
  
  for (const link of reportLinks) {
    const href = await link.getAttribute('href');
    const text = await link.textContent();
    if (href && (href.includes('/report') || (text && text.includes('查看')))) {
      console.log('Found link:', href, '|', text.substring(0, 30));
      await link.click();
      await page.waitForTimeout(3000);
      break;
    }
  }
  
  // Check dimension headers
  const dimHeaders = await page.locator('.report-dim-header').count();
  console.log('Dimension headers:', dimHeaders);
  
  // Expand all
  for (let i = 0; i < dimHeaders; i++) {
    const btn = page.locator('.report-dim-header').nth(i);
    const text = await btn.textContent();
    console.log('Expanding:', text.substring(0, 30));
    await btn.click();
    await page.waitForTimeout(500);
  }
  
  await page.waitForTimeout(1000);
  
  // Screenshot
  await page.screenshot({ path: SCREENSHOT_DIR + '/tier2_verify_step1.png', fullPage: true });
  console.log('Screenshot 1 saved');
  
  // Check product cards
  const productCards = await page.locator('.report-product-card').count();
  console.log('Product cards:', productCards);
  
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
  
  console.log('\n=== Products found ===');
  for (const p of products) {
    console.log('  #' + p.index + ': ' + (p.hasImage ? 'IMG OK' : 'IMG MISSING') + ' | ' + (p.name||'') + ' | ' + (p.price||'') + ' | ' + (p.brand||''));
  }
  
  // Check image loading
  const imageStatus = await page.evaluate(() => {
    const imgs = document.querySelectorAll('.report-product-img');
    return Array.from(imgs).map(img => ({
      src: img.src.substring(0, 60),
      naturalWidth: img.naturalWidth,
      complete: img.complete,
    }));
  });
  
  console.log('\n=== Image load status ===');
  for (const img of imageStatus) {
    console.log('  ' + (img.naturalWidth > 0 ? 'LOADED' : 'BROKEN') + ': ' + img.src);
  }
  
  // Look for suspicious products
  const suspicious = products.filter(p => {
    const priceNum = p.price ? parseFloat(p.price.replace(/[¥,]/g, '')) : 0;
    const name = (p.name || '').toLowerCase();
    return priceNum > 0 && priceNum < 50;
  });
  
  if (suspicious.length > 0) {
    console.log('\n⚠️ SUSPICIOUS LOW-PRICED PRODUCTS:');
    for (const sp of suspicious) {
      console.log('  ' + sp.name + ' | ' + sp.price + ' | img:' + (sp.hasImage ? 'yes' : 'NO'));
    }
  } else {
    console.log('\n✅ No suspicious low-priced products (<¥50)');
  }
  
  await page.screenshot({ path: SCREENSHOT_DIR + '/tier2_verify_step2.png', fullPage: true });
  console.log('Screenshot 2 saved');
  
  await browser.close();
  console.log('\n=== Done ===');
})();
