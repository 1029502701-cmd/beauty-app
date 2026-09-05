import { chromium } from 'playwright';
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const R = [];
  const log = (l, o, d) => { R.push({ l, o, d: String(d) }); console.log((o ? 'PASS' : 'FAIL') + '|' + l + '|' + d); };
  try {
    await pg.goto('https://ccfu.ccwu.cc/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForTimeout(4000);
    const html = await pg.content();
    log('首页加载', true, pg.url());
    log('新JS版本', html.includes('C5siVTyJ'), html.match(/index-\w+\.js/)?.[0] || 'not found');
    await pg.goto('https://ccfu.ccwu.cc/report', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForTimeout(5000);
    const bodyText = await pg.textContent('body');
    log('Report页面无白屏', bodyText && bodyText.length > 100, 'len=' + (bodyText?.length || 0));
    log('有上传入口', bodyText.includes('上传') || bodyText.includes('photo'), bodyText ? bodyText.substring(0,100) : '');
    log('有查看详情按钮', bodyText.includes('查看详情') || await pg.locator('button:has-text(\"查看详情\")').count() > 0, '');
  } catch(e) { log('Error', false, e.message); }
  await b.close();
  console.log('\n=== REPORT ===');
  R.forEach(r => console.log((r.o ? 'PASS' : 'FAIL') + '|' + r.l + '|' + r.d));
})();
