const https = require("https");
const fs = require("fs");
async function test() {
  const buf = fs.readFileSync("C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg");
  console.log("Photo size:", buf.length, "bytes");
  const bnd = "----Bnd" + Date.now();
  const crlf = "\r\n";
  const p1 = "--" + bnd + crlf + "Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"" + crlf + "Content-Type: image/jpeg" + crlf + crlf;
  const p2 = crlf + "--" + bnd + "--" + crlf;
  const body = Buffer.concat([Buffer.from(p1, "utf8"), buf, Buffer.from(p2, "utf8")]);
  console.log("Total body size:", body.length);
  
  return new Promise((res, rej) => {
    const r = https.request({
      hostname: "394bd505.beauty-api-pages.pages.dev",
      path: "/api/tier1/analyze",
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=" + bnd,
        "Authorization": "Bearer a8968e33-137a2d6c-c40e-16d7",
        "Content-Length": body.length
      }
    }, x => {
      let b = "";
      x.on("data", c => b += c);
      x.on("end", () => {
        console.log("STATUS:", x.statusCode);
        console.log("HEADERS:", JSON.stringify(x.headers));
        console.log("BODY:", b.substring(0, 500));
        res({ status: x.statusCode, body: b });
      });
    });
    r.on("error", e => { console.error("ERR:", e.message); res({ error: e.message }); });
    r.setTimeout(60000, () => { r.destroy(); res({ error: "timeout" }); });
    r.end(body);
  });
}
test().then(r => { console.log("RESULT:", JSON.stringify(r).substring(0, 300)); process.exit(0); }).catch(e => { console.error("FATAL:", e.message); process.exit(1); });
