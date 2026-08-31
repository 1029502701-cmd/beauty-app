const https = require("https");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PROD = "81eba90d.beauty-api-pages.pages.dev";
const OUT = path.join(process.cwd(), "test_output");
const PHOTO = path.join(process.cwd(), "test_face.jpg");

const PHONE = "13" + String(Date.now()).slice(-9);
const PASSWORD = "TestFace" + String(Date.now()).slice(-4);

function apiPost(p, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: PROD, path: p, method: "POST", headers: hdrs }, x => {
      let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    });
    r.on("error", rej); r.setTimeout(30000, () => { r.destroy(); rej(new Error("timeout")); });
    r.write(JSON.stringify(body)); r.end();
  });
}

function apiMultipartPost(p, fieldName, filePath, token) {
  return new Promise((res, rej) => {
    const bnd = "----Boundary" + Date.now();
    const buf = fs.readFileSync(filePath);
    const c1 = Buffer.from("--" + bnd + "\r\nContent-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"photo.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n");
    const c2 = Buffer.from("\r\n--" + bnd + "--\r\n");
    const body = Buffer.concat([c1, buf, c2]);
    const hdrs = { "Content-Type": "multipart/form-data; boundary=" + bnd };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: PROD, path: p, method: "POST", headers: hdrs }, x => {
      let d = ""; x.on("data", c => d += c); x.on("end", () => { try { res(JSON.parse(d)); } catch(e) { res(d); } });
    });
    r.on("error", rej); r.setTimeout(60000, () => { r.destroy(); rej(new Error("timeout")); });
    r.end(body);
  });
}

(async () => {
  console.log("=== TEST 2: Face Validation ===\n");
  
  // 1. Register
  const regRes = await apiPost("/api/auth/register", { account: PHONE, password: PASSWORD, confirmPassword: PASSWORD });
  const token = regRes.sessionId || regRes.token;
  console.log("[1] Registered, token:", token);
  
  // 2. Test with real face photo
  console.log("\n[2] Uploading REAL FACE photo...");
  const faceRes = await apiMultipartPost("/api/tier1/analyze", "photo", PHOTO, token);
  console.log("    Status: 200");
  console.log("    Response:", JSON.stringify(faceRes).substring(0, 500));
  
  // 3. Test with non-face image (landscape/nature)
  console.log("\n[3] Testing with non-face image (small_test.jpg - should be landscape/scenery)...");
  const nonFacePhoto = path.join(process.cwd(), "small_test.jpg");
  if (fs.existsSync(nonFacePhoto)) {
    try {
      const nfRes = await apiMultipartPost("/api/tier1/analyze", "photo", nonFacePhoto, token);
      console.log("    Status: 200");
      console.log("    Response:", JSON.stringify(nfRes).substring(0, 500));
    } catch(e) {
      console.log("    Error:", e.message);
    }
  } else {
    console.log("    small_test.jpg not found");
  }
  
  // 4. Test with a second different face photo if available
  console.log("\n[4] Testing with test-bare.jpg...");
  const barePhoto = path.join(process.cwd(), "test-bare.jpg");
  if (fs.existsSync(barePhoto)) {
    try {
      const bareRes = await apiMultipartPost("/api/tier1/analyze", "photo", barePhoto, token);
      console.log("    Status: 200");
      console.log("    Response:", JSON.stringify(bareRes).substring(0, 500));
    } catch(e) {
      console.log("    Error:", e.message);
    }
  } else {
    console.log("    test-bare.jpg not found");
  }
  
  console.log("\n=== DONE ===");
})();
