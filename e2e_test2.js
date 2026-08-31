const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function main() {
  const BASE = 'http://127.0.0.1:8788';
  const DB_PATH = path.join(__dirname, 'pages-functions', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '7fcd5891cbc911dba284b564da572e81d2ba2a91a5be3afe226d9ccb3b3854a8.sqlite');
  const SCREENSHOT_DIR = path.join(__dirname, 'test_output');
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const now = Math.floor(Date.now() / 1000);
  const phone = '139' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  const userId = 'user-e2e-' + now;
  const tier1Id = 't1-e2e-' + now;
  const tier2Id = 't2-e2e-' + now;

  // Register and login
  const regRes = await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: phone, password: 'TestPass123', confirmPassword: 'TestPass123' })
  });
  const loginRes = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: phone, password: 'TestPass123' })
  });
  const token = (await loginRes.json()).sessionId;
  console.log('[1] Login OK, phone:', phone);

  // Create DB records
  const conn = new sqlite3.Database(DB_PATH);
  const tier1Report = JSON.stringify({
    faceShape: 'oval', skinType: 'dry-combination', eyebrowShape: 'natural-arch',
    eyeShape: 'almond', threeFiveRatio: 'balanced', symmetry: 'high',
    facePhotoKey: 'test.jpg', detailedAnalysis: 'test analysis'
  });
  conn.run('INSERT OR IGNORE INTO users (id,phone,created_at,updated_at) VALUES (?,?,?,?)', [userId, phone, now * 1000, now * 1000]);
  conn.run('INSERT OR IGNORE INTO reports_tier1 (id,user_id,report_data,created_at) VALUES (?,?,?,?)', [tier1Id, userId, tier1Report, now * 1000]);
  conn.run('INSERT OR IGNORE INTO reports_tier2 (id,user_id,source_tier1_report_id,generation_status,content,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
    [tier2Id, userId, tier1Id, 'pending', JSON.stringify({ status: 'pending' }), now * 1000, now * 1000]);
  conn.close();
  console.log('[2] DB records created');

  // Trigger tier2 generation via status API
  console.log('[3] Triggering tier2 generation...');
  const statusRes = await fetch(BASE + '/api/tier2/status?tier1ReportId=' + encodeURIComponent(tier1Id), {
    headers: { Authorization: 'Bearer ' + token }
  });
  const statusText = await statusRes.text();
  console.log('  Status API response (' + statusRes.status + '):', statusText.substring(0, 300));

  let tier2ReportId = null;
  try { tier2ReportId = JSON.parse(statusText).tier2ReportId; } catch {}
  if (!tier2ReportId) {
    console.log('  Trying alternate endpoint...');
    const genRes = await fetch(BASE + '/api/tier2/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ reportId: tier2Id })
    });
    const genText = await genRes.text();
    console.log('  Generate API (' + genRes.status + '):', genText.substring(0, 300));
    try { tier2ReportId = JSON.parse(genText).tier2ReportId; } catch {}
  }

  if (!tier2ReportId) {
    console.log('  Could not get tier2ReportId, checking DB directly...');
    const db = new sqlite3.Database(DB_PATH);
    db.get('SELECT id, generation_status FROM reports_tier2 WHERE id = ?', [tier2Id], (e, r) => {
      console.log('  DB tier2:', JSON.stringify(r));
      db.close();
    });
    return;
  }
  console.log('  tier2ReportId:', tier2ReportId);

  // Poll for completion
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(BASE + '/api/tier2/status?tier2Id=' + encodeURIComponent(tier2ReportId), {
      headers: { Authorization: 'Bearer ' + token }
    });
    const pollText = await pollRes.text();
    let pollData;
    try { pollData = JSON.parse(pollText); } catch {
      console.log('  Poll ' + i + ': non-JSON response (' + pollRes.status + '):', pollText.substring(0, 100));
      continue;
    }
    console.log('  Poll ' + i + ': status=' + pollData.generationStatus);
    if (pollData.generationStatus === 'ready') {
      console.log('  Tier2 READY! Content keys:', Object.keys(pollData.content || {}).join(', '));
      if (pollData.content && pollData.content.productRecs) {
        for (const [dim, items] of Object.entries(pollData.content.productRecs)) {
          console.log('    ' + dim + ':', JSON.stringify(items).substring(0, 200));
        }
      }
      break;
    } else if (pollData.generationStatus === 'failed') {
      console.log('  Tier2 FAILED');
      break;
    }
  }

  // Launch browser
  console.log('\n[4] Launching browser...');
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const browserCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await browserCtx.newPage();
  page.on('console', msg => console.log('[BR]', msg.type(), msg.text().substring(0, 100)));
  page.on('pageerror', err => console.log('[ERR]', err.message.substring(0, 100)));

  await page.goto(BASE + '/report', { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('session_token', t), token);
  await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);
  console.log('  URL:', page.url());

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_page.png'), fullPage: true });
  console.log('  Screenshot 1 saved');

  // Expand all dimension sections
  const dimCount = await page.locator('.report-dim-header').count();
  console.log('  Dimensions:', dimCount);
  for (let i = 0; i < dimCount; i++) {
    const btn = page.locator('.report-dim-header').nth(i);
    const text = await btn.textContent();
    console.log('    Dim ' + i + ':', text.substring(0, 40));
    try {
      const isExp = await btn.evaluate(el => {
        let p = el.parentElement;
        while (p) { if (p.classList && p.classList.contains('report-dim')) return p.classList.contains('expanded'); p = p.parentElement; }
        return false;
      });
      if (!isExp) { await btn.click(); await page.waitForTimeout(500); }
    } catch (e) {}
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'report_expanded.png'), fullPage: true });
  console.log('  Screenshot 2 saved');

  // Extract product data
  const products = await page.evaluate(() => Array.from(document.querySelectorAll('.report-product-card')).map((card, i) => {
    const img = card.querySelector('img');
    const name = card.querySelector('.report-product-name');
    const price = card.querySelector('.report-product-price');
    const brand = card.querySelector('.report-product-brand');
    const desc = card.querySelector('.report-product-desc');
    const a = card.closest('a');
    return {
      index: i, hasImage: !!(img && img.src),
      imageUrl: img ? img.src : null,
      name: name ? name.textContent.trim() : null,
      price: price ? price.textContent.trim() : null,
      brand: brand ? brand.textContent.trim() : null,
      desc: desc ? desc.textContent.trim() : null,
      link: a ? a.href : null
    };
  }));
  console.log('\n  Products (' + products.length + '):');
  for (const p of products) {
    console.log('    #' + p.index + ': ' + (p.hasImage ? 'IMG✓' : 'IMG✗') + ' | ' + (p.name || 'none'));
    if (p.price) console.log('         Price: ' + p.price);
    if (p.link) console.log('         Link: ' + p.link.substring(0, 100));
    if (!p.hasImage && p.name) console.log('         Desc: ' + (p.desc || '').substring(0, 60));
  }

  // Screenshot each card
  for (let i = 0; i < products.length; i++) {
    const card = page.locator('.report-product-card').nth(i);
    if (await card.isVisible().catch(() => false)) {
      await card.screenshot({ path: path.join(SCREENSHOT_DIR, 'product_card_' + i + '.png') });
      console.log('    Card ' + i + ' screenshot saved');
    }
  }

  // Test image loading
  console.log('\n  Image loading test:');
  for (const p of products.filter(x => x.hasImage)) {
    try {
      const imgResp = await fetch(p.imageUrl, { headers: { 'Referer': BASE + '/' } });
      console.log('    ' + (imgResp.ok ? 'OK' : 'FAIL') + ' ' + p.name + ' (' + imgResp.status + ')');
    } catch (e) {
      console.log('    ERR ' + p.name + ' ' + e.message);
    }
  }

  await browser.close();
  console.log('\n=== E2E TEST COMPLETE ===');
}
main().catch(e => { console.error('Failed:', e.message); process.exit(1); });
