const fs = require('fs');
const d = 'C:/Users/yao/Documents/ChatGPT/美妆app/';

// Test 1: Polling E2E
fs.writeFileSync(d + 'test_polling_e2e.js', \const { chromium } = require('playwright');
const BASE = 'http://localhost:5174';
const TOKEN = '8f4873ff-746d-4170-9308-90b106aea95a';
const REPORT_ID = '44ef8170-9176-40f2-ba2b-7aabb6802ada';
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const statusRequests = [];
  page.on('request', req => {
    if (req.url().includes('/tier2/status')) {
      statusRequests.push({ t: Date.now(), url: req.url() });
      console.log('[REQ #' + statusRequests.length + '] ' + new Date().toISOString() + ' ' + req.url());
    }
  });
  page.on('response', async resp => {
    if (resp.url().includes('/tier2/status')) {
      try { const body = await resp.json(); console.log('[RES] status=' + resp.status() + ' genStatus=' + (body.generationStatus||'N/A') + ' hasContent=' + !!body.content); } catch(e) {}
    }
  });
  console.log('=== NAVIGATING TO REPORT PAGE ===');
  await page.goto(BASE + '/report?reportId=' + REPORT_ID + '&token=' + TOKEN, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('[URL] ' + page.url());
  await page.waitForTimeout(3000);
  const initBody = await page.evaluate(() => document.body.innerText);
  console.log('[INIT BODY] ' + initBody.substring(0, 400));
  console.log('=== LOOKING FOR 进阶 TAB ===');
  const allBtns = await page.\$\button;
  let clicked = false;
  for (let i = 0; i < allBtns.length; i++) {
    const t = await allBtns[i].innerText().catch(() => '');
    if (t.includes('进阶')) { await allBtns[i].click(); console.log('[CLICKED 进阶 at btn index ' + i + ']'); clicked = true; break; }
  }
  if (!clicked) console.log('[WARNING: 进阶 button not found, buttons count=' + allBtns.length);
  await page.waitForTimeout(8000);
  const finalBody = await page.evaluate(() => document.body.innerText);
  console.log('[FINAL BODY] ' + finalBody.substring(0, 800));
  const hasReport = finalBody.includes('核心建议') || finalBody.includes('风格定位') || finalBody.includes('推荐产品');
  console.log('');
  console.log('=== RESULTS ===');
  console.log('Total /tier2/status requests: ' + statusRequests.length);
  if (statusRequests.length > 0) {
    console.log('First request: ' + new Date(statusRequests[0].t).toISOString());
    console.log('Last request:  ' + new Date(statusRequests[statusRequests.length-1].t).toISOString());
    console.log('Duration ms:   ' + (statusRequests[statusRequests.length-1].t - statusRequests[0].t));
  }
  console.log('Report content visible: ' + hasReport);
  await page.screenshot({ path: 'test_output/test_polling_final.png', fullPage: true });
  console.log('[Screenshot saved: test_output/test_polling_final.png]');
  await browser.close();
  console.log('=== DONE ===');
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
\);
console.log('written test_polling_e2e.js');

// Test 2: Face validation
fs.writeFileSync(d + 'test_face_validation.js', \const { chromium } = require('playwright');
const fs2 = require('fs');
const BASE = 'http://localhost:5174';
const TOKEN = '8f4873ff-746d-4170-9308-90b106aea95a';
const images = [
  { name: 'test_face.jpg', path: 'C:/Users/yao/Documents/ChatGPT/美妆app/test_face.jpg', desc: 'real face photo' },
  { name: 'small_test.jpg', path: 'C:/Users/yao/Documents/ChatGPT/美妆app/small_test.jpg', desc: 'small image' },
  { name: 'photo.jpg', path: 'C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg', desc: 'another photo' },
];
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  console.log('=== UPLOADING IMAGES VIA BROWSER FETCH ===');
  for (const img of images) {
    console.log('');
    console.log('--- ' + img.name + ' (' + img.desc + ') ---');
    if (!fs2.existsSync(img.path) || fs2.statSync(img.path).size === 0) { console.log('[SKIP] file empty or missing'); continue; }
    const buf = fs2.readFileSync(img.path);
    const b64 = buf.toString('base64');
    const result = await page.evaluate(async ({ b64, token }) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const fd = new FormData();
      fd.append('photo', blob, 'test.jpg');
      try {
        const res = await fetch('/api/tier1/analyze', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
        const text = await res.text();
        return { status: res.status, body: text };
      } catch (e) { return { status: 0, body: e.message }; }
    }, { b64, token: TOKEN });
    console.log('[HTTP ' + result.status + ']');
    console.log('[BODY] ' + result.body.substring(0, 400));
  }
  console.log('');
  console.log('=== DONE ===');
  await browser.close();
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
\);
console.log('written test_face_validation.js');

// Test 3: Login redirect
fs.writeFileSync(d + 'test_login_redirect.js', \const { chromium } = require('playwright');
const BASE = 'http://localhost:5174';
const PHONE = '13055326649';
const TOKEN = '8f4873ff-746d-4170-9308-90b106aea95a';
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const urlLog = [];
  page.on('framenavigated', nav => {
    urlLog.push({ t: Date.now(), url: nav.url() });
    console.log('[URL ' + urlLog.length + '] ' + new Date().toISOString() + ' -> ' + nav.url());
  });
  console.log('=== TEST 1: Protected page without token ===');
  await page.goto(BASE + '/report?reportId=some-id', { waitUntil: 'domcontentloaded' });
  console.log('[URL after nav] ' + page.url());
  await page.waitForTimeout(1000);
  console.log('');
  console.log('=== TEST 2: Navigate with valid token ===');
  await page.goto(BASE + '/report?reportId=' + TOKEN.split('-')[0] + '&token=' + TOKEN, { waitUntil: 'domcontentloaded' });
  console.log('[URL after nav] ' + page.url());
  await page.waitForTimeout(2000);
  console.log('');
  console.log('=== TEST 3: Navigate to /login ===');
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  console.log('[At login URL] ' + page.url());
  await page.waitForTimeout(500);
  const phoneInput = await page.\input;
  if (phoneInput) {
    console.log('');
    console.log('=== TEST 4: Fill phone and click send ===');
    await phoneInput.fill(PHONE);
    console.log('[Input value] ' + await phoneInput.inputValue());
    await page.waitForTimeout(500);
    const btns = await page.\$\button;
    for (const b of btns) {
      const t = await b.innerText().catch(() => '');
      if (t.includes('发送') || t.includes('Send') || t.includes('获取验证码')) {
        console.log('[Found send button: ' + t + ']');
        await b.click();
        console.log('[CLICKED send]');
        await page.waitForTimeout(3000);
        console.log('[After send URL] ' + page.url());
        break;
      }
    }
  }
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('');
  console.log('[Body content] ' + bodyText.substring(0, 300));
  console.log('');
  console.log('=== URL CHANGE LOG ===');
  urlLog.forEach((u, i) => console.log('  [' + (i+1) + '] ' + new Date(u.t).toISOString() + ' ' + u.url));
  await page.screenshot({ path: 'test_output/test_login_flow.png', fullPage: true });
  console.log('');
  console.log('[Screenshot: test_output/test_login_flow.png]');
  console.log('');
  console.log('=== DONE ===');
  await browser.close();
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
\);
console.log('written test_login_redirect.js');
