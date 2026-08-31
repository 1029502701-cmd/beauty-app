const https = require("https");
const HOST = "f2e219a5.beauty-api-pages.pages.dev";

function apiPost(p, body, token) {
  return new Promise((res) => {
    const d = JSON.stringify(body);
    const r = https.request({ hostname: HOST, path: p, method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "Content-Length": Buffer.byteLength(d) }
    }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res({ raw: b.substring(0, 300) }); } }); });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(30000, () => { r.destroy(); res({ error: "timeout" }); });
    r.write(d); r.end();
  });
}
function apiGet(p, token) {
  return new Promise((res) => {
    const r = https.request({ hostname: HOST, path: p, method: "GET",
      headers: token ? { "Authorization": "Bearer " + token } : {}
    }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res({ raw: b.substring(0, 300) }); } }); });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(30000, () => { r.destroy(); res({ error: "timeout" }); });
    r.end();
  });
}

(async () => {
  // Register
  const reg = await apiPost("/api/auth/register", { account: "1"+Date.now().toString().slice(-10), password: "PicTest1", confirmPassword: "PicTest1" });
  const token = reg.sessionId;
  console.log("Token:", token ? token.substring(0,12) : "FAIL "+JSON.stringify(reg).substring(0,100));
  if (!token) return;

  // Tier1
  const t1 = await apiPost("/api/tier1/analyze", { reportId: "debug-"+Date.now() }, token);
  const tier1Id = t1.reportId;
  console.log("Tier1:", tier1Id || JSON.stringify(t1).substring(0,200));
  if (!tier1Id) return;

  // Unlock Tier2
  const unlock = await apiPost("/api/tier2/unlock-by-ad", { tier1ReportId: tier1Id }, token);
  const tier2Id = unlock.tier2ReportId;
  console.log("Unlock:", tier2Id || JSON.stringify(unlock).substring(0,200));
  if (!tier2Id) return;

  // Generate
  const gen = await apiPost("/api/tier2/generate", { reportId: tier2Id }, token);
  console.log("Generate trigger:", JSON.stringify(gen).substring(0,200));

  // Poll status
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const status = await apiGet("/api/tier2/status?tier2Id=" + tier2Id, token);
    console.log("  Poll " + (i+1) + ": " + JSON.stringify(status).substring(0, 150));
    if (status.generationStatus === "ready" && status.content) {
      const content = status.content;
      const dims = content.dimensions || {};
      const productRecs = content.productRecs || {};
      console.log("  COMPLETED! dims keys: " + Object.keys(dims).join(", "));
      console.log("  productRecs keys: " + Object.keys(productRecs).join(", "));
      
      // Count products with images
      let total = 0, withImg = 0, withLink = 0;
      for (const [dim, items] of Object.entries(productRecs)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          total++;
          if (item.imageUrl && item.imageUrl.startsWith("http")) withImg++;
          if (item.itemUrl && item.itemUrl.startsWith("http")) withLink++;
        }
      }
      console.log("  Products: " + total + " | with image: " + withImg + " | with link: " + withLink);
      
      // Also check dimensions
      let dimTotal = 0, dimImg = 0, dimLink = 0;
      for (const [dim, items] of Object.entries(dims)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          dimTotal++;
          if (item.imageUrl && item.imageUrl.startsWith("http")) dimImg++;
          if (item.itemUrl && item.itemUrl.startsWith("http")) dimLink++;
        }
      }
      console.log("  Dimensions: " + dimTotal + " | with image: " + dimImg + " | with link: " + dimLink);
      break;
    }
    if (status.generationStatus === "failed") {
      console.log("  FAILED");
      break;
    }
  }

  process.exit(0);
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
