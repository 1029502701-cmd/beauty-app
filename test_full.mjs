import { chromium } from 'playwright';
(async () => {
  const b = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const R = [];
  const log = (l, o, d) => { R.push({ l, o, d: String(d) }); console.log((o ? 'PASS' : 'FAIL') + '|' + l + '|' + d); };
  try {
    // 1. Go to ccfu.ccwu.cc - expect redirect to auth
    await pg.goto('https://ccfu.ccwu.cc/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForTimeout(3000);
    log('step1 首页加载', true, pg.url());
    
    // 2. Check if on auth page and verify the redirect URL is correct
    const currentUrl = pg.url();
    log('step2 认证重定向', currentUrl.includes('auth.meijian.top'), currentUrl);
    
    // 3. Check HTML for JS version
    const html = await pg.content();
    const jsMatch = html.match(/index-[\w]+\.js/)?.[0] || 'not in html';
    log('step3 JS版本正确', html.includes('C5siVTyJ'), jsMatch);
    
    // 4. Navigate to /report directly (after auth)
    await pg.goto('https://ccfu.ccwu.cc/report', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForTimeout(5000);
    const bodyText = await pg.textContent('body');
    const bodyLen = bodyText?.length || 0;
    log('step4 Report无白屏', bodyLen > 1000, 'len=' + bodyLen);
    
    // 5. Check if report has upload area or captured content
    const hasUploadText = bodyText?.includes('上传') || bodyText?.includes('photo') || bodyText?.includes('Photo');
    const hasCheckBtn = bodyText?.includes('查看详情') || bodyText?.includes('查看报告');
    log('step5 有上传/分析入口', hasUploadText || hasCheckBtn, bodyText ? bodyText.substring(0, 150).trim() : '');
    log('step6 有查看详情按钮', hasCheckBtn, '');
    
    // 6. Check for preview-related code in page source
    const pageHtml = await pg.content();
    log('step7 JS含preview逻辑', pageHtml.includes('preview'), '');
    
  } catch(e) {
    log('异常', false, e.message);
  }
  await b.close();
  console.log('\n=== 测试报告 ===');
  R.forEach(r => console.log((r.o ? 'PASS' : 'FAIL') + '|' + r.l + '|' + r.d));
})();
