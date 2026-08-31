const https = require("https");
const fs = require("fs");
const HOST = "f2e219a5.beauty-api-pages.pages.dev";

async function req(method, path, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const data = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    if (data) hdrs["Content-Length"] = Buffer.byteLength(data);
    const r = https.request({ hostname: HOST, path: path, method: method, headers: hdrs }, x => {
      let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res({ status: x.statusCode, body: JSON.parse(b) }); } catch (e) { res({ status: x.statusCode, body: b.substring(0, 500) }); } });
    });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(30000, () => { r.destroy(); res({ error: "timeout" }); });
    if (data) r.write(data); r.end();
  });
}
async function multipartReq(path, fieldName, filePath, token) {
  return new Promise((res, rej) => {
    const bnd = "----E2EMultipart" + Date.now();
    const buf = fs.readFileSync(filePath);
    const crlf = "\r\n";
    const p1 = "--" + bnd + crlf + "Content-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"photo.jpg\"" + crlf + "Content-Type: image/jpeg" + crlf + crlf;
    const p2 = crlf + "--" + bnd + "--" + crlf;
    const body = Buffer.concat([Buffer.from(p1, "utf8"), buf, Buffer.from(p2, "utf8")]);
    const hdrs = { "Content-Type": "multipart/form-data; boundary=" + bnd, "Content-Length": body.length };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const r = https.request({ hostname: HOST, path: path, method: "POST", headers: hdrs }, x => {
      let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res({ status: x.statusCode, body: JSON.parse(b) }); } catch (e) { res({ status: x.statusCode, body: b.substring(0, 500) }); } });
    });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(60000, () => { r.destroy(); res({ error: "timeout" }); });
    r.end(body);
  });
}
async function main() {
  // Test with small_test.jpg (12KB, simulating frontend-resized image)
  const reg = await req("POST", "/api/auth/register", { account: "1"+Date.now().toString().slice(-10), password: "PicTest1", confirmPassword: "PicTest1" });
  const token = reg.body.sessionId;
  console.log("Register:", reg.status, token ? "OK" : JSON.stringify(reg.body).substring(0,200));
  if (!token) { process.exit(1); }
  
  // Test with 12KB image (simulates frontend-resized photo)
  const m = await multipartReq("/api/tier1/analyze", "photo", "C:/Users/yao/Documents/ChatGPT/美妆app/small_test.jpg", token);
  console.log("Multipart (12KB, simulating resized):", m.status, m.body.reportId ? "OK "+m.body.reportId : JSON.stringify(m.body).substring(0,200));
  
  // Test with 92KB image (simulate what frontend produces)
  const fs2 = require("fs");
  const buf92 = Buffer.alloc(92000, "x");
  const bnd = "----Bnd92k";
  const p1 = "--" + bnd + "\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"test.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  const p2 = "\r\n--" + bnd + "--\r\n";
  const body92 = Buffer.concat([Buffer.from(p1,"utf8"), buf92, Buffer.from(p2,"utf8")]);
  const reg2 = await req("POST", "/api/auth/register", { account: "1"+Date.now().toString().slice(-10), password: "PicTest1", confirmPassword: "PicTest1" });
  const token2 = reg2.body.sessionId;
  const r92 = await new Promise((res) => {
    const r = https.request({ hostname: HOST, path: "/api/tier1/analyze", method: "POST", headers: { "Content-Type": "multipart/form-data; boundary="+bnd, "Authorization": "Bearer "+token2, "Content-Length": body92.length } }, x => {
      let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res({ status: x.statusCode, body: JSON.parse(b) }); } catch(e) { res({ status: x.statusCode, body: b.substring(0,200) }); } });
    });
    r.setTimeout(60000, () => { r.destroy(); res({ error: "timeout" }); });
    r.end(body92);
  });
  console.log("Multipart (92KB, simulating frontend 1024px Q90):", r92.status, r92.body.reportId ? "OK "+r92.body.reportId : JSON.stringify(r92.body).substring(0,200));
  process.exit(0);
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
