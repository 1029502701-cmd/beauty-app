const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 注入 session token
  await page.goto("http://127.0.0.1:8788");
  await page.evaluate(() => {
    localStorage.setItem("session_token", "58a91a89-76c1-4474-85ce-98fb9c194802");
  });

  // 导航到 Normal 报告页
  await page.goto("http://127.0.0.1:8788/report/t1-e2e-001");
  // 等待 tier2 生成完成（页面会自动轮询）
  await page.waitForTimeout(12000);

  // 用任务指定的代码检测图片加载状态
  const images = await page.$$eval("img", imgs =>
    imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
  );
  console.log(JSON.stringify(images, null, 2));

  // 再测 Extreme 报告页
  await page.goto("http://127.0.0.1:8788/report/t1-e2e-extreme");
  await page.waitForTimeout(12000);

  const images2 = await page.$$eval("img", imgs =>
    imgs.map(img => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }))
  );
  console.log(JSON.stringify(images2, null, 2));

  await browser.close();
})();
