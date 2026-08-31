const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const DB_PATH = path.join(__dirname, "pages-functions", ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject", "b9a6f0e16a2e472874dc29e54456db604a5ec2fd1352c5571a33bfc8718155e4.sqlite");
const KV_BLOB_DIR = path.join(__dirname, "pages-functions", ".wrangler", "state", "v3", "kv", "9f3105f5547642b693452f5f740f8e2c", "blobs");
const SCREENSHOT_DIR = path.join(__dirname, "test_output");
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function dbGet(db, sql, params) {
  return new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
}
function dbRun(db, sql, params) {
  return new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));
}

async function main() {
  const BASE = "http://127.0.0.1:8788";
  const now = Math.floor(Date.now() / 1000);
  const phone = "139" + String(Math.floor(Math.random() * 100000000)).padStart(8, "0");
  const tier1Id = "t1-e2e-" + now;
  const tier2Id = "t2-e2e-" + now;

  const regRes = await fetch(BASE + "/api/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account: phone, password: "TestPass123", confirmPassword: "TestPass123" })
  });
  const regData = await regRes.json();
  console.log("[1] Register:", regData);

  const loginRes = await fetch(BASE + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account: phone, password: "TestPass123" })
  });
  const loginData = await loginRes.json();
  const token = loginData.sessionId;
  console.log("[2] Login OK, token:", token ? token.substring(0, 20) + "..." : "none");

  // Verify KV session
  const kvKeyHash = crypto.createHash("sha256").update("session:" + token).digest("hex");
  const kvPath = path.join(KV_BLOB_DIR, kvKeyHash);
  console.log("[3] KV blob exists:", fs.existsSync(kvPath));
  if (fs.existsSync(kvPath)) {
    const kvData = JSON.parse(fs.readFileSync(kvPath, "utf8"));
    console.log("    userId in KV:", kvData.userId);
  }

  const conn = new sqlite3.Database(DB_PATH);
  const userRow = await dbGet(conn, "SELECT id FROM users WHERE phone = ?", [phone]);
  const userId = userRow.id;
  console.log("[4] userId:", userId);

  const tier1Report = JSON.stringify({
    faceShape: "oval", skinType: "dry-combination", eyebrowShape: "natural-arch",
    eyeShape: "almond", threeFiveRatio: "balanced", symmetry: "high",
    facePhotoKey: "test.jpg", detailedAnalysis: "test analysis"
  });
  await dbRun(conn, "INSERT OR IGNORE INTO reports_tier1 (id,user_id,report_data,created_at) VALUES (?,?,?,?)",
    [tier1Id, userId, tier1Report, now * 1000]);
  await dbRun(conn, "INSERT OR IGNORE INTO reports_tier2 (id,user_id,source_tier1_report_id,generation_status,content,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
    [tier2Id, userId, tier1Id, "pending", JSON.stringify({ status: "pending" }), now * 1000, now * 1000]);
  conn.close();
  console.log("[5] DB records created");

  console.log("[6] Triggering tier2...");
  const statusRes = await fetch(BASE + "/api/tier2/status?tier1ReportId=" + encodeURIComponent(tier1Id), {
    headers: { Authorization: "Bearer " + token }
  });
  const statusData = await statusRes.json();
  console.log("  Initial:", JSON.stringify(statusData).substring(0, 200));
  let tier2ReportId = statusData.tier2ReportId;

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const pollRes = await fetch(BASE + "/api/tier2/status?tier2Id=" + encodeURIComponent(tier2ReportId), {
      headers: { Authorization: "Bearer " + token }
    });
    const pollData = await pollRes.json();
    if (pollData.generationStatus === "ready") {
      console.log("  Tier2 READY!");
      if (pollData.content && pollData.content.productRecs) {
        for (const [dim, items] of Object.entries(pollData.content.productRecs)) {
          console.log("    " + dim + ":", JSON.stringify(items).substring(0, 150));
        }
      }
      break;
    } else if (pollData.generationStatus === "failed") {
      console.log("  Tier2 FAILED");
      break;
    }
    if (i % 5 === 0) console.log("    poll " + i + ": " + pollData.generationStatus);
  }

  console.log("\n[7] Browser...");
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: false, args: ["--no-sandbox"] });
  const browserCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await browserCtx.newPage();
  page.on("console", msg => console.log("[BR]", msg.type(), msg.text().substring(0, 100)));

  const reportUrl = BASE + "/report?id=" + encodeURIComponent(tier1Id);
  console.log("  Going to:", reportUrl);
  await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 20000 });
  
  let currentUrl = page.url();
  console.log("  URL after goto:", currentUrl);
  
  if (!currentUrl.includes("/report")) {
    console.log("  Redirected! Checking localStorage...");
    const ls = await page.evaluate(() => ({
      hasToken: !!localStorage.getItem("session_token"),
      tokenLen: (localStorage.getItem("session_token") || "").length
    }));
    console.log("  localStorage:", JSON.stringify(ls));
    await page.evaluate((t) => localStorage.setItem("session_token", t), token);
    console.log("  Setting token and retrying...");
    await page.goto(reportUrl, { waitUntil: "networkidle", timeout: 20000 });
    currentUrl = page.url();
    console.log("  URL after retry:", currentUrl);
  }
  
  await page.waitForTimeout(5000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "report_page.png"), fullPage: true });
  console.log("  Screenshot 1 OK");

  const dimCount = await page.locator(".report-dim-header").count();
  console.log("  Dimensions:", dimCount);
  for (let i = 0; i < dimCount; i++) {
    const btn = page.locator(".report-dim-header").nth(i);
    const text = await btn.textContent();
    console.log("    Dim " + i + ":", text.substring(0, 40));
    try {
      const isExp = await btn.evaluate(el => {
        let p = el.parentElement;
        while (p) { if (p.classList && p.classList.contains("report-dim")) return p.classList.contains("expanded"); p = p.parentElement; }
        return false;
      });
      if (!isExp) { await btn.click(); await page.waitForTimeout(500); }
    } catch (e) {}
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "report_expanded.png"), fullPage: true });
  console.log("  Screenshot 2 OK");

  const products = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".report-product-card")).map((card, i) => {
      const img = card.querySelector("img");
      const name = card.querySelector(".report-product-name");
      const price = card.querySelector(".report-product-price");
      const brand = card.querySelector(".report-product-brand");
      const desc = card.querySelector(".report-product-desc");
      const a = card.closest("a");
      return {
        index: i, hasImage: !!(img && img.src),
        imageUrl: img ? img.src : null,
        name: name ? name.textContent.trim() : null,
        price: price ? price.textContent.trim() : null,
        brand: brand ? brand.textContent.trim() : null,
        desc: desc ? desc.textContent.trim() : null,
        link: a ? a.href : null
      };
    })
  );
  console.log("\n  Products (" + products.length + "):");
  for (const p of products) {
    console.log("    #" + p.index + ": " + (p.hasImage ? "IMG(ok)" : "IMG(skip)") + " | " + (p.name || "none"));
    if (p.price) console.log("         Price: " + p.price);
    if (p.link) console.log("         Link: " + p.link.substring(0, 100));
  }

  for (let i = 0; i < products.length; i++) {
    const card = page.locator(".report-product-card").nth(i);
    if (await card.isVisible().catch(() => false)) {
      await card.screenshot({ path: path.join(SCREENSHOT_DIR, "product_card_" + i + ".png") });
    }
  }

  console.log("\n  Image loading:");
  for (const p of products.filter(x => x.hasImage)) {
    try {
      const r = await fetch(p.imageUrl, { headers: { Referer: BASE + "/" } });
      console.log("    " + (r.ok ? "OK" : "FAIL") + " " + p.name + " (" + r.status + ")");
    } catch (e) { console.log("    ERR " + p.name); }
  }

  await browser.close();
  console.log("\n=== DONE ===");
}
main().catch(e => { console.error("Failed:", e.message); process.exit(1); });
