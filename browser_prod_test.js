const { chromium } = require("playwright");
const BASE = "https://e9fcd454.beauty-api-pages.pages.dev";
const LARGE_PHOTO = "D:/photo.jpg";
const TOKEN = "397ff435-7f39-400b-9b98-8250d6dabf86";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const p = await context.newPage();
  const callLog = [];

  await p.route("**/api/tier1/analyze", async (route) => {
    const req = route.request();
    const buf = req.postDataBuffer();
    const ct = req.headers()["content-type"] || "";
    const num = callLog.length + 1;
    let photoBytes = 0;
    let photoB64Eq = 0;
    if (buf && ct.includes("multipart")) {
      const text = buf.toString("latin1");
      const bm = ct.match(/boundary=(.+)/);
      const bnd = bm ? "--" + bm[1].trim() : null;
      if (bnd) {
        const parts = text.split(bnd);
        for (let i = 1; i < parts.length; i++) {
          const part = parts[i];
          const cdMatch = part.match(/content-disposition:\s*form-data;\s*name="([^"]*)"/i);
          if (cdMatch && cdMatch[1] === "photo") {
            const bodyIdx = part.indexOf("\r\n\r\n");
            if (bodyIdx >= 0) {
              const body = part.substring(bodyIdx + 4);
              const cleanBody = body.replace(/\r\n$/, "");
              photoBytes = Buffer.byteLength(cleanBody, "latin1");
              photoB64Eq = Math.ceil(photoBytes / 3) * 4;
            }
            break;
          }
        }
      }
    }
    callLog.push({ num, totalBody: buf ? buf.length : 0, photoBytes, photoB64Eq });
    console.log("REQ #" + num + " | total=" + (buf ? buf.length : 0) + "B | photoBytes=" + photoBytes + " | photoB64~" + photoB64Eq);
    await route.continue();
  });

  console.log("=== Production Deploy Verification ===");
  console.log("URL: " + BASE);

  await context.addCookies([{
    name: "session_token",
    value: TOKEN,
    domain: "e9fcd454.beauty-api-pages.pages.dev",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax"
  }]);

  await p.goto(BASE + "/capture", { waitUntil: "networkidle", timeout: 30000 });
  await p.waitForTimeout(2000);
  console.log("Page loaded, uploading large photo...");

  await p.locator("input[type=file]").setInputFiles(LARGE_PHOTO);
  await p.waitForTimeout(5000);

  let analyzingVisible = false;
  try {
    await p.locator(".capture-analyzing").waitFor({ state: "visible", timeout: 20000 });
    analyzingVisible = true;
    console.log("Analysis in progress");
  } catch (e) {
    console.log("Analyzing stage not visible");
  }

  let retryVisible = false;
  try {
    await p.locator(".capture-retry-btn").waitFor({ state: "visible", timeout: 15000 });
    retryVisible = true;
    console.log("Retry button visible - clicking...");
    await p.locator(".capture-retry-btn").click();
    await p.waitForTimeout(10000);
  } catch (e) {
    console.log("Retry button not visible");
  }

  await p.screenshot({ path: "D:/prod_verify.png" }).catch(() => {});

  console.log("\n===== RESULTS =====");
  callLog.forEach(c => {
    console.log("Request #" + c.num + ": totalBody=" + c.totalBody + "B, photoRaw=" + c.photoBytes + "B, photoB64Eq~" + c.photoB64Eq);
  });

  const ORIG = 2557000;
  const THRESH = 400000;
  if (callLog.length >= 1) {
    const last = callLog[callLog.length - 1];
    console.log("\nOriginal est b64: ~" + ORIG + " chars");
    console.log("Last request photoB64: ~" + last.photoB64Eq + " chars (raw=" + last.photoBytes + "B)");
    if (last.photoB64Eq > 0 && last.photoB64Eq < THRESH) {
      console.log("RESULT: PASS - Frontend compression working, photoB64~" + last.photoB64Eq + " chars (< " + THRESH + ")");
      console.log("Compression ratio: " + ((1 - last.photoB64Eq/ORIG)*100).toFixed(1) + "%");
    } else if (last.photoB64Eq >= THRESH) {
      console.log("RESULT: FAIL - photoB64 ~" + last.photoB64Eq + " chars (not compressed)");
    } else {
      console.log("Could not parse multipart, total body: " + last.totalBody + "B");
    }
  }
  console.log("analyzing=" + analyzingVisible + ", retry_visible=" + retryVisible);
  console.log("Screenshot: D:/prod_verify.png");

  await browser.close();
  console.log("Done.");
})();