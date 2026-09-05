const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("=== 测试 ccfu.ccwu.cc ===\n");
  
  // 1. 测试首页加载
  console.log("1. 测试首页加载...");
  await page.goto("https://ccfu.ccwu.cc", { waitUntil: "networkidle", timeout: 30000 });
  console.log("   URL:", page.url());
  console.log("   Title:", await page.title());
  
  // 2. 检查资源加载
  console.log("\n2. 检查静态资源...");
  const html = await page.content();
  const jsMatch = html.match(/src="([^"]+)"/);
  const cssMatch = html.match(/href="([^"]+\.css)"/);
  console.log("   JS:", jsMatch ? jsMatch[1] : "未找到");
  console.log("   CSS:", cssMatch ? cssMatch[1] : "未找到");
  
  // 3. 测试登录跳转
  console.log("\n3. 测试登录跳转...");
  const currentUrl = page.url();
  console.log("   当前 URL:", currentUrl);
  console.log("   是否跳转到登录页:", currentUrl.includes("auth.meijian.top"));
  
  // 4. 截图
  console.log("\n4. 截图...");
  await page.screenshot({ path: "C:\\\\Users\\\\yao\\\\Documents\\\\ChatGPT\\\\美妆app\\\\test_login_page.png" });
  console.log("   已保存到 test_login_page.png");
  
  await browser.close();
  console.log("\n✅ 测试完成");
})();
