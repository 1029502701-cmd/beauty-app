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

async function main() {
  const sizes = [11922, 100000, 500000, 1000000, 1500000, 1918328];
  for (const targetSize of sizes) {
    const buf = Buffer.alloc(targetSize, "x");
    const bnd = "----Bnd"+Date.now();
    const p1 = "--" + bnd + "\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"test.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
    const p2 = "\r\n--" + bnd + "--\r\n";
    const body = Buffer.concat([Buffer.from(p1, "utf8"), buf, Buffer.from(p2, "utf8")]);
    const reg = await req("POST", "/api/auth/register", { account: "1"+Date.now().toString().slice(-10), password: "PicTest1", confirmPassword: "PicTest1" });
    const token = reg.body.sessionId;
    if (!token) { console.log("Size "+targetSize+": register failed"); continue; }
    const r2 = await new Promise((res) => {
      const r = https.request({ hostname: HOST, path: "/api/tier1/analyze", method: "POST", headers: { "Content-Type": "multipart/form-data; boundary="+bnd, "Authorization": "Bearer "+token, "Content-Length": body.length } }, x => {
        let b = ""; x.on("data", c => b += c); x.on("end", () => { try { res({ status: x.statusCode, body: JSON.parse(b) }); } catch(e) { res({ status: x.statusCode, body: b.substring(0,200) }); } });
      });
      r.on("error", e => res({ error: e.message }));
      r.setTimeout(60000, () => { r.destroy(); res({ error: "timeout" }); });
      r.end(body);
    });
    const ok = r2.status === 200 && r2.body.reportId;
    console.log("Size "+targetSize+" ("+Math.round(targetSize/1024)+"KB): "+(ok?"OK "+r2.body.reportId.substring(0,8):r2.status+" "+JSON.stringify(r2.body).substring(0,80)));
  }
  process.exit(0);
}
main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
