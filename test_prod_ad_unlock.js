const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const BASE = 'https://69ca2181.beauty-api-pages.pages.dev';

  console.log('=== Production Test: Ad Unlock Flow ===');

  // Register on production
  const regRes = await fetch(BASE + '/api/auth/login-or-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: '13600000002', password: 'TestPass2', confirmPassword: 'TestPass2' })
  }).then(r => r.json());
  console.log('Register:', JSON.stringify(regRes));
  const token = regRes.sessionId;
  console.log('Token:', token);

  // Create a tier1 report via the API for this account
  const tier1Data = JSON.stringify({
    faceShape: "心形脸", skinType: "敏感肌", eyebrowShape: "拱形眉", eyeShape: "圆眼",
    threeFiveRatio: "中庭偏短", symmetry: "高对称度",
    personaTags: ["甜美可爱"],
    highlight: "额头较宽下巴尖"
  });
  
  const createRes = await fetch(BASE + '/api/test/create-tier1-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ tier1Data })
  }).then(r => r.json()).catch(e => ({ error: e.message }));
  console.log('Create tier1 report:', JSON.stringify(createRes));

  const reportId = createRes.reportId || createRes.id;
  if (!reportId) {
    console.log('Failed to create tier1 report. Trying alternate endpoint...');
    const createRes2 = await fetch(BASE + '/api/tier1/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ tier1Data })
    }).then(r => r.json()).catch(e => ({ error: e.message }));
    console.log('Create tier1 alt:', JSON.stringify(createRes2));
  }

  // Also try the test insert endpoint
  const insertRes = await fetch(BASE + '/api/test/insert-tier1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ tier1Data, reportId: 'prod-test-002' })
  }).then(r => r.json()).catch(e => ({ error: e.message }));
  console.log('Insert tier1:', JSON.stringify(insertRes));

  // Set up browser with token and session data
  await page.addInitScript((t, data) => {
    localStorage.setItem('session_token', t);
    sessionStorage.setItem('capture_report_prod-test-002', data);
    sessionStorage.clear();
    sessionStorage.setItem('capture_report_prod-test-002', data);
  }, token, tier1Data);

  // Track network requests
  const tier2Requests = [];
  page.on('request', (req) => {
    if (req.url().includes('tier2/status') && req.method() === 'GET') {
      tier2Requests.push({ t: Date.now(), url: req.url() });
    }
  });

  const navLog = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navLog.push({ t: Date.now(), url: frame.url() });
  });

  console.log('\nNavigating to /report?tab=进阶...');
  await page.goto(BASE + '/report?id=prod-test-002&tab=%E8%BF%9B%E9%98%B6', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  console.log('URL:', page.url());
  await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_ad_start.png', fullPage: true });

  // Check state
  const hasUnlockBtn = await page.locator('button:has-text("看广告解锁")').count();
  const hasProcessing = await page.locator('.report-loading p').count();
  const hasContent = await page.locator('.report-core-card').count();
  const hasNotFound = await page.locator('.report-unlock-prompt').count();
  console.log('Unlock buttons:', hasUnlockBtn, '| Processing:', hasProcessing, '| Content:', hasContent, '| Unlock prompt:', hasNotFound);

  if (hasUnlockBtn > 0) {
    console.log('\n--- Clicking 看广告解锁 ---');
    await page.locator('button:has-text("看广告解锁")').click();

    // Wait for ad overlay
    await page.waitForTimeout(2000);
    const adVisible = await page.locator('.tier2-ad-overlay').count();
    console.log('Ad overlay visible:', adVisible > 0);

    if (adVisible > 0) {
      console.log('Waiting for ad to complete (5s)...');
      await page.waitForTimeout(6000);
      
      const afterAdUrl = page.url();
      const afterAdProcessing = await page.locator('.report-loading p:has-text("AI 正在生成进阶报告")').count();
      const afterAdContent = await page.locator('.report-core-card').count();
      console.log('After ad - URL:', afterAdUrl.replace(BASE, ''));
      console.log('After ad - Processing:', afterAdProcessing, '| Content:', afterAdContent);
      console.log('tier2/status requests so far:', tier2Requests.length);

      if (afterAdProcessing > 0 && afterAdContent === 0) {
        console.log('Stuck in processing! Waiting for polling...');
        try {
          await page.waitForSelector('.report-core-card', { timeout: 30000 });
          console.log('SUCCESS: Content appeared!');
          await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_ad_ready.png', fullPage: true });
        } catch {
          console.log('BUG CONFIRMED: Stuck in processing after 30s');
          console.log('Total tier2/status requests:', tier2Requests.length);
          if (tier2Requests.length > 0) {
            const times = tier2Requests.map(r => Math.round(r.t - tier2Requests[0].t));
            console.log('Request intervals (ms):', times.join(', '));
          }
          await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_ad_stuck.png', fullPage: true });
        }
      } else if (afterAdContent > 0) {
        console.log('Content visible after ad!');
        await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_ad_ready.png', fullPage: true });
      } else {
        console.log('Unexpected state after ad');
        await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_ad_after.png', fullPage: true });
      }
    } else {
      console.log('No ad overlay appeared. Checking current state...');
      const currentState = await page.evaluate(() => {
        return {
          url: window.location.pathname,
          processing: document.querySelector('.report-loading p')?.textContent || 'none',
          hasCoreCard: document.querySelector('.report-core-card') !== null
        };
      });
      console.log('State:', JSON.stringify(currentState));
      await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_ad_no_overlay.png', fullPage: true });
    }
  } else if (hasContent > 0) {
    console.log('Content already visible');
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_ad_already.png', fullPage: true });
  } else if (hasNotFound > 0) {
    console.log('Showing unlock prompt but no ad button - checking buttons');
    const btnTexts = await page.locator('button').allTextContents();
    console.log('All buttons:', btnTexts.filter(t => t.trim()));
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_ad_prompt.png', fullPage: true });
  } else {
    console.log('No unlock button, no content, no prompt');
    const pageText = await page.textContent('body');
    console.log('Page text (first 500 chars):', pageText.substring(0, 500));
    await page.screenshot({ path: 'C:\\Users\\yao\\Documents\\ChatGPT\\美妆app\\prod_ad_unknown.png', fullPage: true });
  }

  console.log('\n=== Test Complete ===');
  await browser.close();
})();
