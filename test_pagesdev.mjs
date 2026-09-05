import { chromium } from 'playwright';
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const R = [];
  const log = (l, o, d) => { R.push({ l, o, d: String(d) }); console.log((o ? 'PASS' : 'FAIL') + '|' + l + '|' + d); };
  try {
    // Test pages.dev directly (may not have auth middleware)
    await pg.goto('https://beauty-api-pages.pages.dev/report', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForTimeout(5000);
    const url = pg.url();
    log('pages.dev Report URL', !url.includes('auth.meijian'), url);
    const bodyText = await pg.textContent('body');
    const bodyLen = bodyText?.length || 0;
    log('Report有内容', bodyLen > 2000, 'len=' + bodyLen + ', preview=' + bodyText.substring(0, 200).trim());
    
    // Check for key UI elements
    const hasUpload = bodyText?.includes('上传') || bodyText?.includes('分析');
    const hasCheckBtn = bodyText?.includes('查看详情');
    log('有上传入口', hasUpload, '');
    log('有查看详情按钮', hasCheckBtn, '');
    
    // Check JS bundle
    const html = await pg.content();
    const jsMatch = html.match(/index-[\w]+\.js/)?.[0];
    log('JS版本', jsMatch?.includes('C5siVTyJ') || jsMatch?.includes('Bhzj2wjm'), jsMatch);
  } catch(e) {
    log('异常', false, e.message);
  }
  await b.close();
  console.log('\n=== REPORT ===');
  R.forEach(r => console.log((r.o ? 'PASS' : 'FAIL') + '|' + r.l + '|' + r.d));
})();
