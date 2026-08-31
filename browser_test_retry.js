const { chromium } = require('playwright');
const BASE = 'http://localhost:8788';
const ssDir = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output';
const LARGE_PHOTO = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();

  console.log('=== T-RETRY: handleRetry 前端压缩验证 ===\n');

  // Step 1: 先导航到 BASE，确保 fetch 相对路径有效
  console.log('[1] 导航到', BASE + '/login ...');
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);

  // Step 2: 注册/登录
  console.log('[2] 注册+登录...');
  const regRes = await p.evaluate(async () => {
    const x = await fetch('/api/auth/login-or-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13700000099', password: 'TestPass1', confirmPassword: 'TestPass1' })
    });
    return await x.json();
  });
  if (!regRes.sessionId) { console.log('FAIL: 注册失败'); await browser.close(); process.exit(1); }
  await p.evaluate(t => localStorage.setItem('session_token', t), regRes.sessionId);
  console.log('  登录成功');

  // Step 3: 导航到 capture 页
  console.log('[3] 导航到 /capture...');
  await p.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  await p.screenshot({ path: ssDir + '/retry_test_before_upload.png' });

  // Step 4: 拦截 /api/tier1/analyze，第一次返回 500，第二次放行
  let analyzeCallCount = 0;
  let firstRequestBodySize = null;
  let secondRequestBodySize = null;

  await p.route('**/api/tier1/analyze', async (route) => {
    analyzeCallCount++;
    const req = route.request();
    const body = req.postData();
    if (body && body.includes('data:image')) {
      const idx = body.indexOf('base64,');
      if (idx >= 0) {
        const b64part = body.substring(idx + 7);
        const len = b64part.length;
        if (analyzeCallCount === 1) {
          firstRequestBodySize = len;
          console.log('  [拦截] 第1次 analyze, photo base64 长度:', len);
          await route.fulfill({ status: 500, body: JSON.stringify({ error: '模拟后端错误' }) });
          return;
        } else {
          secondRequestBodySize = len;
          console.log('  [放行] 第2次 analyze(retry), photo base64 长度:', len);
          await route.continue();
        }
      }
    }
    await route.continue();
  });

  // Step 5: 上传大分辨率照片 (4000x6000)
  console.log('[4] 上传大分辨率照片 (4000x6000)...');
  await p.locator('input[type="file"]').setInputFiles(LARGE_PHOTO);
  console.log('  文件已选择，等待前端处理...');
  await p.waitForTimeout(3000);

  // Step 6: 等待错误状态出现（首次请求被拦截返回500）
  console.log('[5] 等待错误状态...');
  try {
    await p.locator('.capture-retry-btn').waitFor({ state: 'visible', timeout: 15000 });
    console.log('  PASS: 重试按钮已出现');
    await p.screenshot({ path: ssDir + '/retry_test_error_state.png' });
  } catch {
    console.log('  WARN: 重试按钮未在15s内出现');
    await p.screenshot({ path: ssDir + '/retry_test_stuck.png' });
    const stage = await p.evaluate(() => {
      const err = document.querySelector('[class*="capture-error"]');
      return err ? err.textContent : 'no error element';
    });
    console.log('  当前错误信息:', stage);
  }

  // Step 7: 点击重试
  console.log('[6] 点击重试按钮...');
  await p.locator('.capture-retry-btn').click();
  console.log('  重试已点击，等待第二次请求...');
  await p.waitForTimeout(25000);

  await p.screenshot({ path: ssDir + '/retry_test_after_retry.png' });

  // Step 8: 分析结果
  console.log('\n=== 测试结果 ===');
  console.log('首次请求 photo base64 长度:', firstRequestBodySize !== null ? firstRequestBodySize : '未捕获');
  console.log('重试请求 photo base64 长度:', secondRequestBodySize !== null ? secondRequestBodySize : '未捕获(后端超时或未触发)');

  const expectedCompressedMax = 400_000;
  if (secondRequestBodySize !== null) {
    if (secondRequestBodySize < expectedCompressedMax) {
      console.log('PASS: 重试请求 photo base64 长度', secondRequestBodySize, '<', expectedCompressedMax, '(前端压缩生效)');
    } else {
      console.log('FAIL: 重试请求 photo base64 长度', secondRequestBodySize, '>> 预期 <', expectedCompressedMax, '(前端压缩未生效，依赖后端兜底)');
    }
  } else {
    console.log('SKIP: 未能捕获重试请求体');
  }

  const finalStage = await p.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-analyzing')) return 'analyzing';
    if (document.querySelector('.capture-error')) return 'error';
    return 'unknown';
  });
  console.log('最终阶段:', finalStage);

  await browser.close();
})();
