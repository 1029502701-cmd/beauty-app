const https = require('https');
const fs = require('fs');
const PROD = '81eba90d.beauty-api-pages.pages.dev';
const PHOTO = process.cwd() + '/test_face.jpg';
const phone = '13' + String(Date.now()).slice(-9);
const password = 'TestPic' + String(Date.now()).slice(-4);
function post(p, body, token) {
  return new Promise((res, rej) => {
    const hdrs = { 'Content-Type': 'application/json' };
    if (token) hdrs['Authorization'] = 'Bearer ' + token;
    const r = https.request({ hostname: PROD, path: p, method: 'POST', headers: hdrs }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res(d)); });
    r.on('error', rej); r.setTimeout(30000, () => { r.destroy(); rej(new Error('timeout')); });
    r.write(JSON.stringify(body)); r.end();
  });
}
function get(p, token) {
  return new Promise((res, rej) => {
    const r = https.request({ hostname: PROD, path: p, method: 'GET', headers: token ? { 'Authorization': 'Bearer ' + token } : {} }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res(d)); });
    r.on('error', rej); r.setTimeout(30000, () => { r.destroy(); rej(new Error('timeout')); });
    r.end();
  });
}
function multipart(p, fieldName, filePath, token) {
  return new Promise((res, rej) => {
    const bnd = '----DBG' + Date.now();
    const buf = fs.readFileSync(filePath);
    const c1 = Buffer.from('--' + bnd + '\r\nContent-Disposition: form-data; name="' + fieldName + '"; filename="photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n');
    const c2 = Buffer.from('\r\n--' + bnd + '--\r\n');
    const body = Buffer.concat([c1, buf, c2]);
    const hdrs = { 'Content-Type': 'multipart/form-data; boundary=' + bnd };
    if (token) hdrs['Authorization'] = 'Bearer ' + token;
    const r = https.request({ hostname: PROD, path: p, method: 'POST', headers: hdrs }, x => { let d = ''; x.on('data', c => d += c); x.on('end', () => res(d)); });
    r.on('error', rej); r.setTimeout(60000, () => { r.destroy(); rej(new Error('timeout')); });
    r.end(body);
  });
}
(async () => {
  const reg = JSON.parse(await post('/api/auth/register', { account: phone, password, confirmPassword: password }));
  const t = JSON.parse(await post('/api/auth/phone/login-password', { phone, password })).sessionId;
  const t1 = JSON.parse(await multipart('/api/tier1/analyze', 'photo', PHOTO, t));
  console.log('Tier1:', t1.reportId);
  const share = JSON.parse(await post('/api/tier1/share', { reportId: t1.reportId }, t));
  console.log('Tier2:', share.tier2ReportId);
  let tier2Id = share.tier2ReportId;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const st = JSON.parse(await get('/api/tier2/status?tier2Id=' + tier2Id, t));
    if (i % 5 === 0) console.log('Poll ' + (i+1) + ':', st.generationStatus);
    if (st.generationStatus === 'ready') {
      const pr = st.content.productRecs || {};
      const dims = Object.keys(pr);
      let enriched = 0, total = 0;
      const summary = [];
      for (const dim of dims) {
        const items = pr[dim] || [];
        for (const item of items) {
          total++;
          const hi = !!(item.imageUrl && item.imageUrl.length > 10);
          const hl = !!(item.itemUrl && item.itemUrl.length > 10);
          const hp = item.price != null && item.price > 0;
          if (hi && hl && hp) enriched++;
          console.log('  [' + dim + '] ' + item.name + ' img=' + hi + ' link=' + hl + ' price=' + hp);
          if (hi) console.log('    img: ' + item.imageUrl.substring(0, 80));
          if (hl) console.log('    link: ' + item.itemUrl.substring(0, 80));
          if (hp) console.log('    price: ' + item.price);
          summary.push({ dim: dim, name: item.name, hasImg: hi, hasLink: hl, hasPrice: hp, imageUrl: item.imageUrl, itemUrl: item.itemUrl, price: item.price });
        }
      }
      console.log('Enriched: ' + enriched + '/' + total);
      const outPath = process.cwd() + '/test_output/e2e_81eba90d_data.json';
      fs.writeFileSync(outPath, JSON.stringify({ summary: summary, tier2Data: st.content }, null, 2));
      console.log('Data saved to:', outPath);
      break;
    }
    if (st.generationStatus === 'failed') { console.error('FAIL'); process.exit(1); }
  }
})();
