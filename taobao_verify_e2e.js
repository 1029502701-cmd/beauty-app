const { chromium } = require("playwright");
const BASE = "http://localhost:8788";
const PHOTO_PATH = "C:/Users/yao/Documents/ChatGPT/美妆app/pages-functions/test_output/face_photo.jpg";
const fs = require("fs");
const path = require("path");

const TEST_LOG = fs.mkdtempSync(path.join("C:/Temp", "tb_verify_"));
const SCREENSHOTS = path.join(TEST_LOG, "screenshots");
fs.mkdirSync(SCREENSHOTS, { recursive: true });

async function apiCall(method, endpoint, body) {
  const url = BASE + endpoint;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  return await resp.json();
}

async function main() {
  console.log("=== 淘宝联盟商品数据 Tier2 验证测试 ===\n");
  console.log("时间:", new Date().toISOString());
  console.log("日志目录:", TEST_LOG, "\n");

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const p = await browser.newPage();

  // Step 1: 注册新账号
  console.log("[1] 注册新账号...");
  const newPhone = "13700000100";
  const newPwd = "TestPass99";

  let sessionId = null;
  try {
    const regRes = await apiCall("POST", "/api/auth/login-or-register", {
      account: newPhone, password: newPwd, confirmPassword: newPwd
    });
    console.log("  注册响应:", JSON.stringify(regRes));
    sessionId = regRes?.sessionId || regRes?.token || regRes?.session_token;
    if (sessionId) {
      await p.context().addCookies([{
        name: "session_token", value: String(sessionId),
        domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax"
      }]);
      console.log("  [OK] 登录成功, session:", String(sessionId).substring(0, 8) + "...");
    }
  } catch (e) {
    console.log("  [FAIL] 注册异常:", e.message);
  }

  if (!sessionId) {
    console.log("  尝试直接登录...");
    try {
      const loginRes = await apiCall("POST", "/api/auth/login", { account: newPhone, password: newPwd });
      console.log("  登录响应:", JSON.stringify(loginRes));
      sessionId = loginRes?.sessionId || loginRes?.token;
      if (sessionId) {
        await p.context().addCookies([{
          name: "session_token", value: String(sessionId),
          domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax"
        }]);
      }
    } catch (e2) {
      console.log("  [FAIL] 登录失败:", e2.message);
    }
  }

  if (!sessionId) {
    console.log("  回退到已有账号 13700000094...");
    try {
      const fallbackRes = await apiCall("POST", "/api/auth/login", { account: "13700000094", password: "TestPass6" });
      sessionId = fallbackRes?.sessionId || fallbackRes?.token;
      if (sessionId) {
        await p.context().addCookies([{
          name: "session_token", value: String(sessionId),
          domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax"
        }]);
        console.log("  使用回退账号 session");
      }
    } catch (e3) {
      console.log("  [FAIL] 回退登录也失败:", e3.message);
    }
  }

  if (!sessionId) {
    console.log("  [FAIL] 无法获取任何 session，测试终止");
    await browser.close();
    process.exit(1);
  }

  // Step 2: 上传照片进行 Tier1 分析
  console.log("\n[2] 上传照片进行 Tier1 分析...");
  await p.goto(BASE + "/capture", { waitUntil: "networkidle", timeout: 30000 });
  await p.waitForTimeout(2000);

  await p.locator("input[type=file]").setInputFiles(PHOTO_PATH);
  console.log("  照片已上传，等待分析...");

  try {
    await p.waitForSelector(".capture-done, .capture-error, .capture-analyzing", { state: "visible", timeout: 90000 });
  } catch {}

  await p.waitForTimeout(8000);

  const stage = await p.evaluate(() => {
    if (document.querySelector(".capture-done")) return "done";
    if (document.querySelector(".capture-error")) return "error";
    if (document.querySelector(".capture-analyzing")) return "analyzing";
    return "unknown";
  });
  console.log("  当前阶段:", stage);
  await p.screenshot({ path: path.join(SCREENSHOTS, "step2_stage.png") });

  // 获取报告列表找 tier1
  let tier1ReportId = null;
  try {
    const reportsData = await apiCall("GET", "/api/reports/mine");
    console.log("  报告列表:", JSON.stringify(reportsData?.reports)?.substring(0, 500));

    if (reportsData?.reports) {
      const t1 = reportsData.reports.find(r => r.tier === 1);
      if (t1) {
        tier1ReportId = t1.id;
        console.log("  [OK] Tier1 报告 ID:", tier1ReportId);
      }
    }
  } catch (e) {
    console.log("  获取报告列表失败:", e.message);
  }

  // Step 3: 触发 Tier2
  let tier2Content = null;
  let tier2ReportId = null;

  if (tier1ReportId) {
    console.log("\n[3] 触发 Tier2 生成...");

    try {
      const statusRes = await apiCall("GET", "/api/tier2/status?tier1ReportId=" + tier1ReportId);
      console.log("  Tier2 状态:", JSON.stringify(statusRes));

      if (statusRes.generationStatus === "ready" && statusRes.tier2ReportId) {
        tier2ReportId = statusRes.tier2ReportId;
        tier2Content = statusRes.content;
        console.log("  [OK] Tier2 报告已存在（缓存），ID:", tier2ReportId);
      } else if (statusRes.generationStatus === "processing") {
        tier2ReportId = statusRes.tier2ReportId;
        console.log("  Tier2 正在生成中...");
      } else {
        const genRes = await apiCall("POST", "/api/tier2/generate", { reportId: tier1ReportId });
        console.log("  生成触发响应:", JSON.stringify(genRes));
        tier2ReportId = genRes.id;
      }
    } catch (e) {
      console.log("  Tier2 状态检查失败:", e.message);
    }

    // 轮询等待
    if (tier2ReportId) {
      console.log("  轮询 Tier2 完成状态...");
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const pollRes = await apiCall("GET", "/api/tier2/status?tier2Id=" + tier2ReportId);
          console.log("    [" + (i + 1) + "] status=" + pollRes.generationStatus);
          if (pollRes.generationStatus === "ready") {
            tier2Content = pollRes.content;
            console.log("  [OK] Tier2 生成完成!");
            break;
          } else if (pollRes.generationStatus === "failed") {
            console.log("  [FAIL] Tier2 生成失败");
            break;
          }
        } catch (e) {
          console.log("    轮询出错:", e.message);
        }
      }
    }
    await p.screenshot({ path: path.join(SCREENSHOTS, "step3_tier2.png") });
  } else {
    console.log("\n[3] 跳过：无 Tier1 报告 ID");
  }

  // Step 4: 分析 productRecs
  console.log("\n[4] 分析 productRecs 内容...");
  const results = {
    taobaoIntegrationExists: false,
    hasRealProductData: false,
    productRecsKeys: null,
    sampleProducts: [],
    allProductRecs: null,
    issues: []
  };

  // 从 reports/mine 获取最新 tier2
  let latestTier2 = null;
  try {
    const latestReports = await apiCall("GET", "/api/reports/mine");
    console.log("  最新报告:", JSON.stringify(latestReports?.reports?.map(r => ({
      tier: r.tier, id: r.id?.substring(0, 8), hasContent: !!r.content
    }))));

    const t2s = latestReports?.reports?.filter(r => r.tier === 2) || [];
    if (t2s.length > 0) {
      latestTier2 = t2s[0];
      console.log("  最新 Tier2:", latestTier2.id, "content type:", typeof latestTier2.content);
    }
  } catch (e) {
    console.log("  获取报告列表失败:", e.message);
  }

  let contentObj = tier2Content;
  if (!contentObj && latestTier2) {
    try {
      contentObj = typeof latestTier2.content === "string"
        ? JSON.parse(latestTier2.content)
        : latestTier2.content;
    } catch (e) {
      console.log("  解析 content 失败:", e.message);
    }
  }

  if (contentObj) {
    const pr = contentObj.productRecs;
    console.log("  productRecs 值:", typeof pr, Array.isArray(pr), pr ? "keys=[" + Object.keys(pr).join(", ") + "]" : "null");

    if (pr && typeof pr === "object" && !Array.isArray(pr)) {
      results.productRecsKeys = Object.keys(pr);
      const dims = ["faceShape", "skinType", "eyebrowShape", "eyeShape", "threeFiveRatio", "symmetry"];

      for (const dim of dims) {
        const items = pr[dim];
        if (!items) {
          results.issues.push("维度 " + dim + " 缺失");
          continue;
        }
        if (typeof items === "string") {
          results.issues.push("维度 " + dim + " 是字符串而非数组: " + items.substring(0, 60));
          continue;
        }
        if (Array.isArray(items) && items.length > 0) {
          console.log("  [" + dim + "] " + items.length + " 个推荐:");
          for (let j = 0; j < Math.min(items.length, 2); j++) {
            const item = items[j];
            const keys = Object.keys(item);
            console.log("    [" + j + "] keys=[" + keys.join(", ") + "] val=" + JSON.stringify(item).substring(0, 150));

            const hasImage = !!item.image || !!item.imageUrl || !!item.imgUrl || !!item.picUrl;
            const hasPrice = !!item.price || !!item.priceRange || !!item.finalPrice;
            const hasLink = !!item.link || !!item.url || !!item.purchaseUrl || !!item.taobaoUrl || !!item.itemUrl;
            const hasTaobaoId = !!item.itemNum || !!item.itemId || !!item.shopId || !!item.numIid;
            const hasCoupon = !!item.coupon || !!item.couponLink || !!item.couponInfo;

            if (hasImage || hasPrice || hasLink) results.hasRealProductData = true;
            if (hasTaobaoId || hasLink || hasCoupon) results.taobaoIntegrationExists = true;

            if (j === 0 && results.sampleProducts.length < 2) {
              results.sampleProducts.push({ dimension: dim, item: item });
            }
          }
        } else {
          results.issues.push("维度 " + dim + " 格式异常: " + typeof items);
        }
      }
    } else if (pr === null || pr === undefined) {
      results.issues.push("productRecs 字段不存在");
    } else {
      results.issues.push("productRecs 类型异常: " + typeof pr);
    }

    const { productRecs: _, ...rest } = contentObj;
    console.log("  content 其他字段:", Object.keys(rest).join(", "));
    results.allProductRecs = pr;
  } else {
    results.issues.push("未找到可分析的 Tier2 内容");
  }

  // Step 5: 结论
  console.log("\n========== 验证结论 ==========");
  console.log("1. 淘宝集成是否存在: " + (results.taobaoIntegrationExists ? "YES" : "NO"));
  console.log("2. 真实商品数据: " + (results.hasRealProductData ? "YES" : "NO"));
  console.log("3. productRecs 维度: " + (results.productRecsKeys?.join(", ") || "无"));
  console.log("4. 问题:");
  if (results.issues.length === 0) {
    console.log("   (无)");
  } else {
    for (const issue of results.issues) console.log("   - " + issue);
  }
  if (results.sampleProducts.length > 0) {
    console.log("\n5. 样本商品:");
    for (const sp of results.sampleProducts) {
      console.log("   [" + sp.dimension + "] " + JSON.stringify(sp.item, null, 2));
    }
  }
  if (results.allProductRecs) {
    console.log("\n6. 完整 productRecs:");
    console.log(JSON.stringify(results.allProductRecs, null, 2));
  }

  await p.screenshot({ path: path.join(SCREENSHOTS, "final_result.png") });
  console.log("\n截图:", path.join(SCREENSHOTS, "final_result.png"));
  console.log("日志目录:", TEST_LOG);

  await browser.close();
}

main().catch(e => {
  console.error("测试失败:", e);
  process.exit(1);
});
