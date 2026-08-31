const https = require('https');
const fs = require('fs');
async function test() {
  const hosts = ['e9fcd454.beauty-api-pages.pages.dev', '394bd505.beauty-api-pages.pages.dev'];
  for (const host of hosts) {
    console.log('Testing:', host);
    const reg = await new Promise((res, rej) => {
      const d = JSON.stringify({ account: '1' + Date.now().toString().slice(-10), password: 'MpTest1', confirmPassword: 'MpTest1' });
      const r = https.request({ hostname: host, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(d) } }, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => res(JSON.parse(b))); });
      r.on('error', e => res({ error: e.message })); r.setTimeout(15000, () => { r.destroy(); res({ error: 'timeout' }); });
      r.write(d); r.end();
    });
    const token = reg.sessionId;
    console.log('  Register:', token ? 'OK' : JSON.stringify(reg).substring(0, 80));
    if (!token) continue;
    const buf = fs.readFileSync('C:/Users/yao/Documents/ChatGPT/美妆app/photo.jpg');
    const bnd = '----Bnd' + Date.now();
    const p1 = '--' + bnd + String.fromCharCode(13,10) + 'Content-Disposition: form-data; name="photo"; filename="photo.jpg"' + String.fromCharCode(13,10) + 'Content-Type: image/jpeg' + String.fromCharCode(13,10) + String.fromCharCode(13,10);
    const p2 = String.fromCharCode(13,10) + '--' + bnd + '--' + String.fromCharCode(13,10);
    const body = Buffer.concat([Buffer.from(p1, 'utf8'), buf, Buffer.from(p2, 'utf8')]);
    const t1 = await new Promise((res, rej) => {
      const r = https.request({ hostname: host, path: '/api/tier1/analyze', method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=' + bnd, 'Authorization': 'Bearer ' + token, 'Content-Length': body.length } }, x => { let b = ''; x.on('data', c => b += c); x.on('end', () => { try { res(JSON.parse(b)); } catch(e) { res({ raw: b.substring(0, 200) }); } }); });
      r.on('error', e => res({ error: e.message }));
      r.setTimeout(60000, () => { r.destroy(); res({ error: 'timeout' }); });
      r.end(body);
    });
    console.log('  Tier1:', t1.reportId ? 'OK ' + t1.reportId : JSON.stringify(t1).substring(0, 150));
    console.log();
  }
}
test().catch(e => console.error(e.message));