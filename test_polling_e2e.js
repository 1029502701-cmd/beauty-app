const { chromium } = require('playwright');
const BASE = 'http://localhost:5174';
const TOKEN = '8f4873ff-746d-4170-9308-90b106aea95a';
const REPORT_ID = '44ef8170-9176-40f2-ba2b-7aabb6802ada';
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // Navigate to app base first, then set localStorage
  await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
  await page.evaluate((token) => {
    localStorage.setItem('session_token', token);
    console.log('[LOCALSTORAGE] set session_token = ' + token.substring(0,8) + '...');
  }, TOKEN);
  await page.waitForTimeout(500);
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
  await page.goto(BASE + '/report?id=' + REPORT_ID, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('[URL] ' + page.url());
  await page.waitForTimeout(3000);
  const initBody = await page.evaluate(() => document.body.innerText);
  console.log('[INIT BODY] ' + initBody.substring(0, 400));
  console.log('=== LOOKING FOR 进阶 TAB ===');
  const allBtns = await page.$$('button');
  let clicked = false;
  for (let i = 0; i < allBtns.length; i++) {
    const t = await allBtns[i].innerText().catch(() => '');
    if (t.includes('进阶')) { await allBtns[i].click(); console.log('[CLICKED 进阶 at btn index ' + i + ']'); clicked = true; break; }
  }
  if (!clicked) console.log('[WARNING: 进阶 not found, buttons=' + allBtns.length);
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
  console.log('[Screenshot: test_output/test_polling_final.png]');
  await browser.close();
  console.log('=== DONE ===');
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });