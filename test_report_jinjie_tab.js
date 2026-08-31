const { chromium } = require('playwright');
const http = require('http');
const BASE = 'http://127.0.0.1:8788';
const OUT = 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\test_output';
const fs = require('fs');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function post(path, body, hdrs) {
  return new Promise((res, rej) => {
    const r = http.request({hostname:'127.0.0.1',port:8788,path,method:'POST',headers:hdrs||{'Content-Type':'application/json'}}, x => { let d=''; x.on('data',c=>d+=c); x.on('end',()=>{try{res(JSON.parse(d))}catch(e){res(d)}}); });
    r.on('error',rej); r.write(JSON.stringify(body)); r.end();
  });
}
function get(path, hdrs) {
  return new Promise((res, rej) => {
    const r = http.request({hostname:'127.0.0.1',port:8788,path,method:'GET',headers:hdrs||{}}, x => { let d=''; x.on('data',c=>d+=c); x.on('end',()=>{try{res(JSON.parse(d))}catch(e){res(d)}}); });
    r.on('error',rej); r.end();
  });
}

(async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
  const pg = await ctx.newPage();
  const snaps = [];
  async function snap(n) {
    const p = OUT + '/' + n + '.png';
    await pg.screenshot({ path: p, fullPage: false });
    snaps.push(p);
    console.log('[SNAP]', n);
  }

  // Login
  console.log('=== Login ===');
  await post('/api/auth/phone/send-code', { phone: '1390000001' });
  const codeR = await get('/api/debug/sms-code?phone=1390000001');
  const login = await post('/api/auth/phone/login', { phone: '1390000001', code: codeR.code });
  const userToken = login.sessionId || login.token;
  console.log('Login OK, token:', (userToken||'').substring(0,12));
  await pg.addInitScript(({ t }) => { localStorage.setItem('session_token', t); }, { t: userToken });

  // Admin login
  const adminLogin = await post('/api/admin/login', { username: '15961962243', password: '123456bn' });
  const adminToken = adminLogin.sessionId;
  console.log('Admin OK');

  const T1_ID = 'test-t1-login-1787954358';

  // Ensure tier2_btn_color is black
  await post('/api/admin/config', { key: 'tier2_btn_color', value: '#000000' }, { Authorization: 'Bearer ' + adminToken });
  await pg.goto(BASE + '/config/tier2_btn_color', { waitUntil: 'networkidle', timeout: 10000 });
  const cfgBefore = await pg.evaluate(() => document.body.innerText);
  console.log('Config endpoint before:', cfgBefore.substring(0, 100));

  // Navigate to /report?tab=进阶
  console.log('\n=== Navigate to /report?id=' + T1_ID + '&tab=进阶 ===');
  await pg.goto(BASE + '/report?id=' + T1_ID + '&tab=进阶', { waitUntil: 'networkidle', timeout: 15000 });
  await pg.waitForTimeout(3000);

  // CHECK 1: 6-step card UI exists
  console.log('\n--- CHECK 1: 6-step card UI ---');
  const stepCheck = await pg.evaluate(() => {
    const stepCards = document.querySelectorAll('.t2-step-card');
    const stepTitles = Array.from(stepCards).map(c => {
      const el = c.querySelector('.t2-step-title');
      return el ? el.textContent.trim() : '(no title)';
    });
    const hasHero = !!document.querySelector('.t2-card--hero');
    const hasShareBtn = !!document.querySelector('.t2-share-btn');
    const hasHookBtn = !!document.querySelector('.t2-btn-hook');
    return { stepCardCount: stepCards.length, stepTitles, hasHero, hasShareBtn, hasHookBtn };
  });
  console.log('Step UI:', JSON.stringify(stepCheck, null, 2));
  await snap('check1_report_jinjie_tab');

  // CHECK 2: Data is real (not mock)
  console.log('\n--- CHECK 2: Real data (not mock) ---');
  const dataCheck = await pg.evaluate(() => {
    const heroEl = document.querySelector('.t2-hero-main-title');
    const subtitleEl = document.querySelector('.t2-hero-subtitle span:nth-child(2)');
    const decodeEl = document.querySelector('.t2-hero-decode-text');
    const summaryEl = document.querySelector('.t2-summary-text');
    const mockEl = document.querySelector('.t2-ai-hint');
    return {
      mainTitle: heroEl ? heroEl.textContent.trim() : '(none)',
      subtitle: subtitleEl ? subtitleEl.textContent.trim() : '(none)',
      decodeText: decodeEl ? decodeEl.textContent.trim().substring(0, 60) : '(none)',
      summaryText: summaryEl ? summaryEl.textContent.trim().substring(0, 60) : '(none)',
      isMock: mockEl ? mockEl.textContent.trim() : 'no-hint',
      hasSteps: document.querySelectorAll('.t2-step-card').length > 0
    };
  });
  console.log('Data check:', JSON.stringify(dataCheck, null, 2));

  // CHECK 3: Button color reads from config (default #000000 = black)
  console.log('\n--- CHECK 3: Button color from config ---');
  const btnColorBefore = await pg.evaluate(() => {
    const btns = document.querySelectorAll('.t2-btn, .t2-share-btn');
    return Array.from(btns).map(b => ({
      text: b.textContent.trim().substring(0, 15),
      bg: getComputedStyle(b).backgroundColor
    }));
  });
  console.log('Button colors (before):', JSON.stringify(btnColorBefore, null, 2));

  // CHECK 4: Product modal
  console.log('\n--- CHECK 4: Product modal ---');
  const lightbulbCount = await pg.locator('.t2-lightbulb-btn').count();
  console.log('Lightbulb buttons found:', lightbulbCount);
  if (lightbulbCount > 0) {
    await pg.locator('.t2-lightbulb-btn').first().click();
    await pg.waitForTimeout(600);
    const modalCheck = await pg.evaluate(() => {
      const inner = document.querySelector('.t2-modal-overlay-inner');
      if (!inner) return { error: 'modal not found' };
      const cards = inner.querySelectorAll('.t2-product-card');
      const names = Array.from(inner.querySelectorAll('.t2-product-name')).map(el => el.textContent.trim().substring(0, 20));
      const links = Array.from(inner.querySelectorAll('.t2-product-link-text')).map(el => el.textContent.trim().substring(0, 30));
      const copyBtns = inner.querySelectorAll('.t2-copy-btn');
      return { productCount: cards.length, names, hasLinks: links.length > 0, hasCopyBtns: copyBtns.length > 0 };
    });
    console.log('Modal check:', JSON.stringify(modalCheck, null, 2));
    await snap('check4_product_modal');
    await pg.locator('.t2-modal-close').click();
    await pg.waitForTimeout(400);
  }

  // CHECK 5: Config change -> button color changes dynamically
  console.log('\n--- CHECK 5: Dynamic btnColor ---');
  await post('/api/admin/config', { key: 'tier2_btn_color', value: '#FF4444' }, { Authorization: 'Bearer ' + adminToken });
  await pg.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await pg.waitForTimeout(3000);
  const btnColorAfter = await pg.evaluate(() => {
    const btns = document.querySelectorAll('.t2-btn, .t2-share-btn');
    return Array.from(btns).map(b => ({
      text: b.textContent.trim().substring(0, 15),
      bg: getComputedStyle(b).backgroundColor
    }));
  });
  console.log('Button colors (after red):', JSON.stringify(btnColorAfter, null, 2));
  const isRed = btnColorAfter.some(b => b.bg.includes('255, 68, 68'));
  console.log('Color changed to red:', isRed ? 'YES (OK)' : 'NO (BUG)');
  await snap('check5_btn_red');

  // Restore black
  await post('/api/admin/config', { key: 'tier2_btn_color', value: '#000000' }, { Authorization: 'Bearer ' + adminToken });
  await pg.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await pg.waitForTimeout(3000);

  // CHECK 6: Share & Hook buttons
  console.log('\n--- CHECK 6: Share & Hook ---');
  const uiCheck = await pg.evaluate(() => {
    const shareBtn = document.querySelector('.t2-share-btn');
    const hookBtn = document.querySelector('.t2-btn-hook');
    const hookText = document.querySelector('.t2-tier3-hook-text');
    return {
      shareBtnText: shareBtn ? shareBtn.textContent.trim() : '(none)',
      hookBtnText: hookBtn ? hookBtn.textContent.trim() : '(none)',
      hookLabelText: hookText ? hookText.textContent.trim() : '(none)'
    };
  });
  console.log('UI elements:', JSON.stringify(uiCheck, null, 2));
  await snap('check6_final');

  await browser.close();
  console.log('\n=== All tests done ===');
  console.log('Screenshots:', snaps.join(', '));
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });