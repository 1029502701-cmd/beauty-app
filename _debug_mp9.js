const https = require("https");
const fs = require("fs");
const HOST = "f2e219a5.beauty-api-pages.pages.dev";

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
      console.log("STATUS:", x.statusCode);
      console.log("CONTENT-TYPE:", x.headers["content-type"]);
      console.log("ALL HEADERS:", JSON.stringify(x.headers, null, 2));
      let b = "";
      x.on("data", c => b += c);
      x.on("end", () => {
        console.log("RAW BODY:", JSON.stringify(b));
        console.log("BODY bytes:", Buffer.byteLength(b));
        res({ status: x.statusCode, rawBody: b });
      });
    });
    r.on("error", e => res({ error: e.message }));
    r.setTimeout(60000, () => { r.destroy(); res({ error: "timeout" }); });
    r.end(body);
  });
}
async function main() {
  const reg = await new Promise((res) => {
    const d = JSON.stringify({ account: "1" + Date.now().toString().slice(-10), password: "PicTest1", confirmPassword: "PicTest1" });
    const r = https.request({ hostname: HOST, path: "/api/auth/register", method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(d) } }, x => {
      let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res(JSON.parse(b)); } catch(e) { res({raw: b}); } });
    });
    r.setTimeout(15000, () => { r.destroy(); res({error:"timeout"}); });
    r.write(d); r.end();
  });
  console.log("Register:", reg.sessionId ? "OK" : JSON.stringify(reg).substring(0,200));
  const token = reg.sessionId;
  if (!token) { process.exit(1); }
  await multipartReq("/api/tier1/analyze", "photo", "C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg", token);
  process.exit(0);
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
