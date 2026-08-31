const { chromium } = require('playwright');
const fs = require('fs');
const BASE = 'https://69ca2181.beauty-api-pages.pages.dev';
const TOKEN = 'f7731c17-2e63-4fc9-b372-2f317d881f8a';
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const statusRequests = [];
  page.on('request', req => {
    if (req.url().includes('/tier2/status')) {
      statusRequests.push({ t: Date.now(), url: req.url() });
      console.log('[REQ #' + statusRequests.length + '] ' + new Date().toISOString() + ' ' + new URL(req.url()).pathname + '?' + new URL(req.url()).searchParams.toString());
    }
  });
  page.on('response', async resp => {
    if (resp.url().includes('/tier2/status')) {
      try { const body = await resp.json(); console.log('[RES] status=' + resp.status() + ' genStatus=' + (body.generationStatus||'N/A') + ' hasContent=' + !!body.content); } catch(e) {}
    }
  });
  console.log('=== NAVIGATING TO PROD ===');
  await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' });
  console.log('[URL] ' + page.url());
  // Set token
  await page.evaluate((token) => { localStorage.setItem('session_token', token); }, TOKEN);
  console.log('[LOCALSTORAGE] set');
  await page.waitForTimeout(500);
  // Get user reports
  console.log('=== GETTING REPORTS ===');
  const reports = await page.evaluate(async (token) => {
    try {
      const r = await fetch('https://69ca2181.beauty-api-pages.pages.dev/api/reports/list?limit=3', { headers: {Authorization: 'Bearer ' + token} });
      return await r.json();
    } catch(e) { return {error: e.message}; }
  }, TOKEN);
  console.log('[Reports] ' + JSON.stringify(reports).substring(0, 400));
  if (!reports.reports || reports.reports.length === 0) {
    console.log('[SKIP] No reports for this user, cannot test tier2 polling');
    await browser.close();
    return;
  }
  const reportId = reports.reports[0].id;
  console.log('[Using reportId: ' + reportId + ']');
  console.log('=== NAVIGATING TO REPORT PAGE ===');
  await page.goto(BASE + '/report?id=' + reportId, { waitUntil: 'networkidle', timeout: 30000 });
  console.log('[URL] ' + page.url());
  await page.waitForTimeout(3000);
  const initBody = await page.evaluate(() => document.body.innerText);
  console.log('[INIT BODY] ' + initBody.substring(0, 300));
  // Click 进阶 tab
  const allBtns = await page.$$('button');
  for (let i = 0; i < allBtns.length; i++) {
    const t = await allBtns[i].innerText().catch(() => '');
    if (t.includes('进阶')) { await allBtns[i].click(); console.log('[CLICKED 进阶 at ' + i + ']'); break; }
  }
  await page.waitForTimeout(10000);
  const finalBody = await page.evaluate(() => document.body.innerText);
  console.log('[FINAL BODY] ' + finalBody.substring(0, 600));
  const hasReport = finalBody.includes('核心建议') || finalBody.includes('风格定位') || finalBody.includes('推荐产品');
  console.log('');
  console.log('=== RESULTS ===');
  console.log('Total /tier2/status requests: ' + statusRequests.length);
  if (statusRequests.length > 0) {
    console.log('First: ' + new Date(statusRequests[0].t).toISOString());
    console.log('Last:  ' + new Date(statusRequests[statusRequests.length-1].t).toISOString());
    console.log('Duration ms: ' + (statusRequests[statusRequests.length-1].t - statusRequests[0].t));
  }
  console.log('Report content visible: ' + hasReport);
  await page.screenshot({ path: 'test_output/prod_test.png', fullPage: true });
  console.log('[Screenshot: test_output/prod_test.png]');
  await browser.close();
  console.log('=== DONE ===');
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });