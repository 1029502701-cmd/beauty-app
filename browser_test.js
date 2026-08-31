const { chromium } = require('playwright');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

function md5(s) { return crypto.createHash('md5').update(s).digest('hex').toUpperCase(); }

async function searchTaobao(kw, limit) {
  limit = limit || 10;
  var p = {
    app_key: '35375517', method: 'taobao.tbk.dg.material.optional.upgrade',
    timestamp: String(Math.floor(Date.now()/1000)), v: '2.0', sign_method: 'md5',
    q: kw, page_no: '1', page_size: String(limit),
    fields: 'num_iid,title,pict_url,small_images,resale_price,final_promotion_price,item_url,shop_title,seller_nick,coupon_info,click_url,short_title,brand_name,volume,user_type,zk_final_price',
    adzone_id: '116312800133'
  };
  var sk = Object.keys(p).sort();
  var ps = '3e45726cf39668b52c03d7f4d9e869d3';
  for (var i = 0; i < sk.length; i++) ps += sk[i] + p[sk[i]];
  ps += '3e45726cf39668b52c03d7f4d9e869d3';
  p.sign = md5(ps);
  var qs = Object.entries(p).map(function(e){return e[0]+'='+encodeURIComponent(e[1])}).join('&');
  return new Promise(function(resolve, reject) {
    https.get('https://eco.taobao.com/router/rest?'+qs, {headers:{'User-Agent':'BeautyApp/1.0'}}, function(res) {
      var data = '';
      res.on('data', function(c){ data += c; });
      res.on('end', function() {
        var parse = function(tag) {
          var re = new RegExp('<'+tag+'>([^<]*)</'+tag+'>', 'g');
          var r = []; var m;
          while ((m = re.exec(data)) !== null) r.push(m[1]);
          return r;
        };
        var ts = parse('title'), pr = parse('zk_final_price');
        var imgs = parse('pict_url'), cls = parse('click_url');
        var sh = parse('shop_title'), br = parse('brand_name');
        resolve(ts.map(function(t,i){
          return { title:t, price:parseFloat(pr[i]||'0'), image:imgs[i]||'', click:cls[i]||'', shop:sh[i]||'', brand:br[i]||'' };
        }));
      });
    }).on('error', reject);
  });
}

async function main() {
  const BASE = 'http://127.0.0.1:8788';
  const DB_PATH = path.join(__dirname, 'pages-functions', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite');
  const BLOB_DIR = path.join(__dirname, 'pages-functions', '.wrangler', 'state', 'v3', 'kv', '9f3105f5547642b693452f5f740f8e2c', 'blobs');
  const SCREENSHOT_DIR = path.join(__dirname, 'test_output');
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const now = Math.floor(Date.now()/1000);
  const userId = 'user-browser-' + now;
  const sessionId = 'sess-browser-' + now;
  const tier1Id = 'test-t1-browser-' + now;
  const tier2Id = 'test-t2-browser-' + now;
  const phone = '13900' + (now % 10000).toString().padStart(4, '0');

  // Create session blob
  const sessionData = JSON.stringify({ userId: userId, expiresAt: now + 7*24*3600 });
  const key = 'session:' + sessionId;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  fs.writeFileSync(path.join(BLOB_DIR, hash), sessionData);
  console.log('[1] Session created:', sessionId, '->', userId);

  // Create DB records
  const conn = new sqlite3.Database(DB_PATH);
  const tier1Report = JSON.stringify({
    faceShape: 'oval', skinType: 'dry-combination',
    eyebrowShape: 'natural-arch', eyeShape: 'almond',
    threeFiveRatio: 'balanced', symmetry: 'high',
    facePhotoKey: 'test-photo.jpg',
    detailedAnalysis: 'Round face with soft features, dry-combination skin, natural arched eyebrows, almond-shaped eyes, balanced three-fifth facial ratio, high symmetry'
  });
  conn.run('INSERT OR IGNORE INTO users (id, phone, created_at, updated_at) VALUES (?,?,?,?)',
    [userId, phone, now*1000, now*1000]);
  conn.run('INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES (?,?,?,?)',
    [tier1Id, userId, tier1Report, now*1000]);
  conn.run('INSERT INTO reports_tier2 (id, user_id, source_tier1_report_id, generation_status, content, created_at) VALUES (?,?,?,?,?,?)',
    [tier2Id, userId, tier1Id, 'pending', JSON.stringify({status:'pending'}), now*1000]);
  conn.close();
  console.log('[2] DB records created');

  // Launch browser
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text().substring(0, 100)));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message.substring(0, 100)));

  // Navigate to the app
  console.log('\n[3] Navigating to app...');
  await page.goto(BASE + '/report', { waitUntil: 'networkidle', timeout: 15000 });
  
  // Check if we're on login page
  const url = page.url();
  console.log('Current URL:', url);
  
  if (url.includes('/login')) {
    console.log('[4] On login page, trying to login...');
    // Try phone login
    await page.fill('input[placeholder*="手机"]||input[name="phone"]||input[type="tel"]', phone);
    await page.getByRole('button', { name: /发送验证码|获取验证码/i }).click();
    await page.waitForTimeout(1000);
    // Check console for the code
    const logs = await page.evaluate(() => {
      return Array.from(console._logs || []).map(l => l.text || '').join('\n');
    });
    // Use code 000000
    await page.fill('input[placeholder*="验证码"]||input[name="code"]||input[type="text"]', '000000');
    await page.getByRole('button', { name: /登录|登录/, exact: false }).click();
    await page.waitForTimeout(2000);
    console.log('After login URL:', page.url());
  }

  // Try to navigate directly
  console.log('\n[5] Navigating to /report...');
  await page.goto(BASE + '/report', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);
  console.log('Final URL:', page.url());
  console.log('Page title:', await page.title());
  
  // Take screenshot of the page
  const screenshotPath = path.join(SCREENSHOT_DIR, 'report_page.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('[6] Screenshot saved:', screenshotPath);

  // Check for product cards
  const productCards = await page.locator('.report-product-card').count();
  console.log('[7] Product cards found:', productCards);
  
  if (productCards > 0) {
    // Screenshot each product card
    for (let i = 0; i < productCards; i++) {
      const card = page.locator('.report-product-card').nth(i);
      const isVisible = await card.isVisible().catch(() => false);
      if (isVisible) {
        const cardPath = path.join(SCREENSHOT_DIR, "product_card_$i.png");
        await card.screenshot({ path: cardPath });
        console.log('  Card', i, 'screenshot:', cardPath);
      }
    }
  }

  // Expand all dimension sections to show products
  const expandButtons = await page.locator('.report-dim-header').count();
  console.log('[8] Dimension headers found:', expandButtons);
  for (let i = 0; i < expandButtons; i++) {
    const btn = page.locator('.report-dim-header').nth(i);
    const text = await btn.textContent();
    console.log('  Dim', i, ':', text.substring(0, 30));
    // Check if already expanded
    const expanded = await btn.locator('~ .report-dim-products').count();
    if (expanded === 0) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  }

  // Take another screenshot after expanding
  const screenshotPath2 = path.join(SCREENSHOT_DIR, 'report_expanded.png');
  await page.screenshot({ path: screenshotPath2, fullPage: true });
  console.log('[9] Expanded screenshot saved:', screenshotPath2);

  // Extract product data from the page
  const products = await page.evaluate(() => {
    const cards = document.querySelectorAll('.report-product-card');
    const results = [];
    cards.forEach((card, i) => {
      const img = card.querySelector('img');
      const name = card.querySelector('.report-product-name');
      const price = card.querySelector('.report-product-price');
      const brand = card.querySelector('.report-product-brand');
      const desc = card.querySelector('.report-product-desc');
      const a = card.closest('a') || card;
      results.push({
        index: i,
        hasImage: !!img,
        imageUrl: img ? img.src : null,
        name: name ? name.textContent.trim() : null,
        price: price ? price.textContent.trim() : null,
        brand: brand ? brand.textContent.trim() : null,
        desc: desc ? desc.textContent.trim() : null,
        link: a.href || null,
      });
    });
    return results;
  });
  
  console.log('\n[10] Product data from page:');
  for (const p of products) {
    console.log('  ' + p.index + ': ' + (p.hasImage ? 'IMG✓' : 'IMG✗') + ' ' + p.name + ' ' + (p.price || '') + ' ' + (p.brand || ''));
    if (p.imageUrl) console.log('     img: ' + p.imageUrl.substring(0, 70));
    if (p.link) console.log('     link: ' + p.link.substring(0, 80));
  }

  await browser.close();
  console.log('\n=== Browser test complete ===');
}

main().catch(e => {
  console.error('Browser test failed:', e.message);
  process.exit(1);
});
