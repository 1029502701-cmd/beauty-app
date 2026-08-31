const https = require("https");
const fs = require("fs");
const HOST = "e9fcd454.beauty-api-pages.pages.dev";

async function req(method, path, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { "Content-Type": "application/json" };
    if (token) hdrs["Authorization"] = "Bearer " + token;
    const data = body ? (typeof body === "string" ? body : JSON.stringify(body)) : null;
    if (data) hdrs["Content-Length"] = Buffer.byteLength(data);
    const r = https.request({ hostname: HOST, path: path, method: method, headers: hdrs }, x => {
      let b = "";
      x.on("data", c => b += c);
      x.on("end", () => { try { res({ status: x.statusCode, body: JSON.parse(b) }); } catch (e) { res({ status: x.statusCode, body: b.substring(0, 500) }); } });
    });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(30000, () => { r.destroy(); res({ error: "timeout" }); });
    if (data) r.write(data);
    r.end();
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
      let b = "";
      x.on("data", c => b += c);
      x.on("end", () => { try { res({ status: x.statusCode, body: JSON.parse(b) }); } catch (e) { res({ status: x.statusCode, body: b.substring(0, 500) }); } });
    });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(60000, () => { r.destroy(); res({ error: "timeout" }); });
    r.end(body);
  });
}
async function main() {
  const reg = await req("POST", "/api/auth/register", { account: "1"+Date.now().toString().slice(-10), password: "PicTest1", confirmPassword: "PicTest1" });
  console.log("Register:", reg.status, reg.body.sessionId ? "OK" : JSON.stringify(reg.body).substring(0,200));
  const token = reg.body.sessionId;
  if (!token) { process.exit(1); }
  const m = await multipartReq("/api/tier1/analyze", "photo", "C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg", token);
  console.log("Multipart tier1:", m.status, JSON.stringify(m.body).substring(0,300));
  process.exit(0);
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
