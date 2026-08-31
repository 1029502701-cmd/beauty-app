const https = require("https");
const fs = require("fs");
async function test() {
  const reg = await new Promise((res, rej) => {
    const d = JSON.stringify({ account: "1" + Date.now().toString().slice(-10), password: "MpTestX1", confirmPassword: "MpTestX1" });
    const r = https.request({ hostname: "394bd505.beauty-api-pages.pages.dev", path: "/api/auth/register", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(d) } }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => res(JSON.parse(b))); });
    r.on("error", e => res({ error: e.message })); r.setTimeout(15000, () => { r.destroy(); res({ error: "timeout" }); });
    r.write(d); r.end();
  });
  const token = reg.sessionId;
  console.log("Register:", token ? "OK token=" + token.substring(0,12) : JSON.stringify(reg).substring(0,200));
  if (!token) return;
  
  // JSON tier1
  const j = await new Promise((res, rej) => {
    const d = JSON.stringify({ reportId: "test-json-only" });
    const r = https.request({ hostname: "394bd505.beauty-api-pages.pages.dev", path: "/api/tier1/analyze", method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "Content-Length": Buffer.byteLength(d) } }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res({raw: b.substring(0,300)}); } }); });
    r.on("error", e => res({ error: e.message })); r.setTimeout(30000, () => { r.destroy(); res({ error: "timeout" }); });
    r.write(d); r.end();
  });
  console.log("JSON tier1:", j.reportId ? "OK " + j.reportId : JSON.stringify(j).substring(0,200));
  
  // Multipart tier1
  const buf = fs.readFileSync("C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg");
  const bnd = "----Bnd" + Date.now();
  const crlf = "\r\n";
  const p1 = "--" + bnd + crlf + "Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"" + crlf + "Content-Type: image/jpeg" + crlf + crlf;
  const p2 = crlf + "--" + bnd + "--" + crlf;
  const body = Buffer.concat([Buffer.from(p1, "utf8"), buf, Buffer.from(p2, "utf8")]);
  const m = await new Promise((res, rej) => {
    const r = https.request({ hostname: "394bd505.beauty-api-pages.pages.dev", path: "/api/tier1/analyze", method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=" + bnd, "Authorization": "Bearer " + token, "Content-Length": body.length } }, x => { let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res({raw: b.substring(0,300)}); } }); });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(60000, () => { r.destroy(); res({ error: "timeout" }); });
    r.end(body);
  });
  console.log("Multipart tier1:", m.reportId ? "OK " + m.reportId : JSON.stringify(m).substring(0,200));
  process.exit(0);
}
test().catch(e => console.error("FATAL:", e.message));

