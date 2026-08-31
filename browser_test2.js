const { chromium } = require('playwright');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

async function main() {
  const BASE = 'http://127.0.0.1:8788';
  const DB_PATH = path.join(__dirname, 'pages-functions', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite');
  const SCREENSHOT_DIR = path.join(__dirname, 'test_output');
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const now = Math.floor(Date.now() / 1000);
  const userId = 'user-browser-' + now;
  const tier1Id = 'test-t1-browser-' + now;
  const tier2Id = 'test-t2-browser-' + now;
  const phone = '139' + String(Math.floor(Math.random()*100000000)).padStart(8,'0');

  // Register via API
  console.log('[1] Registering:', phone);
  const regRes = await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: phone, password: 'TestPass123', confirmPassword: 'TestPass123' })
  });
  const regData = await regRes.json();
  console.log('  Register:', regRes.status, JSON.stringify(regData).substring(0, 200));

  // Login
  console.log('[2] Logging in...');
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: phone, password: 'TestPass123' })
  });
  const loginData = await loginRes.json();
  console.log('  Login:', loginRes.status, JSON.stringify(loginData).substring(0, 300));

  // Create DB records
  console.log('[3] Creating DB records...');
  const conn = new sqlite3.Database(DB_PATH);
  const tier1Report = JSON.stringify({
    faceShape: 'oval', skinType: 'dry-combination', eyebrowShape: 'natural-arch',
    eyeShape: 'almond', threeFiveRatio: 'balanced', symmetry: 'high',
    facePhotoKey: 'test-photo.jpg',
    detailedAnalysis: 'Round face with soft features, dry-combination skin, natural arched eyebrows, almond-shaped eyes, balanced three-fifth facial ratio, high symmetry'
  });
  conn.run('INSERT OR IGNORE INTO users (id, phone, created_at, updated_at) VALUES (?,?,?,?)', [userId, phone, now*1000, now*1000]);
  conn.run('INSERT OR IGNORE INTO reports_tier1 (id, user_id, report_data, created_at) VALUES (?,?,?,?)', [tier1Id, userId, tier1Report, now*1000]);
  conn.run('INSERT OR IGNORE INTO reports_tier2 (id, user_id, source_tier1_report_id, generation_status, content, created_at) VALUES (?,?,?,?,?,?)', [tier2Id, userId, tier1Id, 'completed', JSON.stringify({ status: 'completed' }), now*1000]);
  conn.close();
  console.log('  Done');

  // Launch browser
  console.log('[4] Launching browser...');
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text().substring(0, 120)));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message.substring(0, 120)));

  const sessionId = loginData.sessionId || loginData.session_id;

  console.log('\n[5] Setting auth then navigating...');
  await page.goto(BASE + '/report', { waitUntil: 'domcontentloaded', timeout: 10000 });
  if (sessionId) { await page.evaluate((t) => localStorage.setItem('session_token', t), sessionId); console.log('  localStorage set'); }
  await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log('  URL:', page.url());

  // Screenshot
  const sp1 = path.join(SCREENSHOT_DIR, 'report_page.png');
  await page.screenshot({ path: sp1, fullPage: true });
  console.log('[6] Screenshot:', sp1);

  // Check products
  let hasProducts = await page.evaluate(() => document.querySelectorAll('.report-product-card').length > 0);
  console.log('  Has product cards:', hasProducts);

  if (!hasProducts) {
    console.log('\n[7] No products yet, checking for generate button...');
    const allText = await page.evaluate(() => document.body.innerText);
    console.log('  Page text preview:', allText.substring(0, 500));
  }

  // Expand dimensions
  console.log('\n[8] Expanding dimensions...');
  const dimCount = await page.locator('.report-dim-header').count();
  console.log('  Found', dimCount, 'dimensions');
  for (let i = 0; i < Math.min(dimCount, 10); i++) {
    const btn = page.locator('.report-dim-header').nth(i);
    const text = await btn.textContent();
    console.log('  Dim', i, ':', text.substring(0, 40));
    // Try clicking if collapsed
    try {
      const parent = await btn.evaluate(el => el.parentElement);
      const expanded = await btn.evaluate(el => {
        let p = el.parentElement;
        while (p) {
          if (p.classList && p.classList.contains('report-dim')) return p.classList.contains('expanded') || p.classList.contains('active');
          p = p.parentElement;
        }
        return false;
      });
      if (!expanded) {
        await btn.click();
        await page.waitForTimeout(400);
      }
    } catch(e) {}
  }

  const sp2 = path.join(SCREENSHOT_DIR, 'report_expanded.png');
  await page.screenshot({ path: sp2, fullPage: true });
  console.log('[9] Expanded screenshot:', sp2);

  // Extract products
  const products = await page.evaluate(() => {
    const cards = document.querySelectorAll('.report-product-card');
    return Array.from(cards).map((card, i) => {
      const img = card.querySelector('img');
      const name = card.querySelector('.report-product-name');
      const price = card.querySelector('.report-product-price');
      const brand = card.querySelector('.report-product-brand');
      const desc = card.querySelector('.report-product-desc');
      const a = card.closest('a') || card;
      return {
        index: i, hasImage: !!img && !!img.src, imageUrl: img ? img.src : null,
        name: name ? name.textContent.trim() : null,
        price: price ? price.textContent.trim() : null,
        brand: brand ? brand.textContent.trim() : null,
        desc: desc ? desc.textContent.trim() : null,
        link: a.href || null,
      };
    });
  });

  console.log('\n[10] Products (' + products.length + '):');
  for (const p of products) {
    console.log('  #' + p.index + ': ' + (p.hasImage ? 'IMG✓' : 'IMG✗') + ' | ' + (p.name || 'none'));
    if (p.price) console.log('      Price: ' + p.price);
    if (p.link) console.log('      Link: ' + p.link.substring(0, 100));
    if (!p.hasImage && p.name) console.log('      Desc: ' + (p.desc || '').substring(0, 60));
  }

  // Card screenshots
  for (let i = 0; i < products.length; i++) {
    const card = page.locator('.report-product-card').nth(i);
    if (await card.isVisible().catch(() => false)) {
      const cp = path.join(SCREENSHOT_DIR, 'product_card_' + i + '.png');
      await card.screenshot({ path: cp });
      console.log('  Card ' + i + ':', cp);
    }
  }

  await browser.close();
  console.log('\n=== DONE ===');
}
main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
