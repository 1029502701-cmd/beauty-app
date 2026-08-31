const { chromium } = require('playwright');
const BASE = 'http://localhost:8788';
const ssDir = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output';
const LARGE_PHOTO = 'C:/Users/yao/Documents/ChatGPT/美妆app/test_output/face_photo.jpg';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const p = await browser.newPage();

  console.log('=== T-RETRY: handleRetry 前端压缩验证 ===\n');
  console.log('原图: 4000x6000, 1,918,328 bytes, base64 约 2,557,000 chars\n');

  // 登录
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const regRes = await p.evaluate(async () => {
    const x = await fetch('/api/auth/login-or-register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: '13700000094', password: 'TestPass6', confirmPassword: 'TestPass6' })
    });
    return await x.json();
  });
  await p.evaluate(t => localStorage.setItem('session_token', t), regRes.sessionId);
  console.log('[1] 登录成功');

  await p.goto(BASE + '/capture', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  // 在上传前记录页面中 checkAndResize 的逻辑是否被正确调用
  // 用 route 拦截 analyze 请求，记录每次的 body 并控制响应
  const callLog = [];
  
  await p.route('**/api/tier1/analyze', async (route) => {
    const req = route.request();
    const buf = req.postDataBuffer();
    const bodyLen = buf ? buf.length : 0;
    
    // 从 multipart body 中提取 base64 数据长度
    let b64Len = 0;
    if (buf) {
      const text = buf.toString('utf8');
      // multipart 中 base64 数据在 data:image/xxx;base64, 之后，到下一个 boundary 之前
      const b64Match = text.match(/data:image\/[a-z]+;base64,([^-][\s\S]*?)(?:-- boundaries?| border)/i);
      if (b64Match) {
        // 清理可能包含的 boundary 标记
        const clean = b64Match[1].replace(/[\r\n]/g, '').trim();
        b64Len = clean.length;
      }
      // 备用：直接数 base64, 后面的内容直到遇到 --
      if (b64Len === 0) {
        const idx = text.indexOf('base64,');
        if (idx >= 0) {
          const after = text.substring(idx + 7);
          const endIdx = after.indexOf('\r\n--');
          if (endIdx >= 0) {
            b64Len = after.substring(0, endIdx).replace(/[\r\n]/g, '').length;
          } else {
            b64Len = after.replace(/[\r\n]/g, '').length;
          }
        }
      }
    }
    
    callLog.push({ bodyLen, b64Len });
    console.log('  [call #' + callLog.length + '] body=' + bodyLen + 'B, b64portion=' + b64Len);
    
    if (callLog.length === 1) {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'mock fail' }) });
    } else {
      await route.continue();
    }
  });

  console.log('[2] 上传 4000x6000 大照片...');
  await p.locator('input[type="file"]').setInputFiles(LARGE_PHOTO);
  await p.waitForTimeout(3000);

  // 等待错误状态
  let retryVisible = false;
  try {
    await p.locator('.capture-retry-btn').waitFor({ state: 'visible', timeout: 8000 });
    retryVisible = true;
    console.log('  ✅ 重试按钮已出现');
  } catch {
    console.log('  ⚠️ 重试按钮未出现');
  }
  await p.screenshot({ path: ssDir + '/retry_before_click.png' });

  if (!retryVisible) {
    console.log('  当前阶段:', await p.evaluate(() => {
      if (document.querySelector('.capture-done')) return 'done';
      if (document.querySelector('.capture-error')) return 'error';
      return 'analyzing';
    }));
    await browser.close();
    console.log('\n❌ 测试终止：重试按钮未出现');
    process.exit(1);
  }

  console.log('\n[3] 点击重试按钮...');
  await p.locator('.capture-retry-btn').click();
  await p.waitForTimeout(20000);
  await p.screenshot({ path: ssDir + '/retry_after_click.png' });

  console.log('\n========== 测试结果 ==========');
  console.log('总请求数:', callLog.length);
  callLog.forEach((c, i) => console.log('  请求 ' + (i+1) + ': totalBody=' + c.bodyLen + 'B, b64portion=' + c.b64Len));

  // 关键判断
  const ORIGINAL_B64_EST = 2_557_000;  // 原图 base64 估算
  const THRESHOLD = 400_000;           // 压缩后预期上限

  if (callLog.length >= 2) {
    const first = callLog[0];
    const second = callLog[1];
    
    console.log('\n分析:');
    console.log('  首次请求 body: ' + first.bodyLen + 'B, b64portion: ' + first.b64Len);
    console.log('  重试请求 body: ' + second.bodyLen + 'B, b64portion: ' + second.b64Len);
    
    // 用 b64portion 判断（更准确）
    if (second.b64Len > 0) {
      if (second.b64Len < THRESHOLD) {
        console.log('\n✅ PASS: handleRetry 前端压缩生效');
        console.log('   重试请求 photo base64 = ' + second.b64Len + ' chars (< ' + THRESHOLD + ')');
        console.log('   与原图估算 ' + ORIGINAL_B64_EST + ' chars 对比，压缩率: ' + ((1 - second.b64Len/ORIGINAL_B64_EST)*100).toFixed(1) + '%');
      } else {
        console.log('\n❌ FAIL: handleRetry 前端压缩未生效');
        console.log('   重试请求 photo base64 = ' + second.b64Len + ' chars (>> ' + THRESHOLD + ')');
        console.log('   说明 preview 直接以原图大小发出，靠后端硬兜底');
      }
    } else {
      // 备用：用 totalBody 判断
      if (second.bodyLen < 200_000) {
        console.log('\n✅ PASS: handleRetry 前端压缩生效 (body=' + second.bodyLen + 'B << 原图~2.5MB)');
      } else {
        console.log('\n⚠️ 无法确定 b64 长度，totalBody=' + second.bodyLen + 'B，需人工检查');
      }
    }

    // 比较两次是否一致
    if (Math.abs(second.bodyLen - first.bodyLen) < 500) {
      console.log('\n  两次请求 body 大小一致 (' + first.bodyLen + ' vs ' + second.bodyLen + ')，confirm 压缩逻辑相同');
    } else {
      console.log('\n  两次请求 body 大小不同 (首次 ' + first.bodyLen + ' vs 重试 ' + second.bodyLen + ')');
    }
  }

  const finalStage = await p.evaluate(() => {
    if (document.querySelector('.capture-done')) return 'done';
    if (document.querySelector('.capture-analyzing')) return 'analyzing';
    if (document.querySelector('.capture-error')) return 'error';
    return 'unknown';
  });
  console.log('\n最终阶段:', finalStage);

  await browser.close();
})();
