import { chromium } from 'playwright';
const { execSync } = await import('child_process');

(async () => {
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' });
  const page = await ctx.newPage();

  const results = [];
  const log = (label, ok, detail) => {
    const r = { label, ok, detail };
    results.push(r);
    console.log(ok ? `✅ ${label}` : `❌ ${label}: ${detail}`);
  };

  try {
    // 1. Open home
    await page.goto('https://ccfu.ccwu.cc/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    log('页面加载', true, page.url());
    log('URL 正确', page.url().includes('ccfu.ccwu.cc'), page.url());
    log('HTML包含新JS', (await page.content()).includes('index-C5siVTyJ'), (await page.content()).match(/index-\w+\.js/)?.[0]);

    // 2. Check report page without params - should not crash
    await page.goto('https://ccfu.ccwu.cc/report', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    log('Report页面无白屏', !page.url().includes('about:blank') && page.url().includes('ccfu.ccwu.cc'), page.url());
    const body = await page.content();
    log('Report页有内容', body.length > 5000, `body length: ${body.length}`);
  } catch(e) {
    log('测试异常', false, e.message);
  }

  await browser.close();
  console.log('\n=== 测试结果 ===');
  results.forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.label}: ${r.detail}`));
})();
