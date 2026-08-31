const http = require('http');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8788';

function post(path, body, headers) {
  return new Promise((res, rej) => {
    const r = http.request({hostname:'127.0.0.1',port:8788,path,method:'POST',headers:headers||{'Content-Type':'application/json'}}, x => { let d=''; x.on('data',c=>d+=c); x.on('end',()=>{try{res(JSON.parse(d))}catch(e){res(d)}}); });
    r.on('error',rej); r.write(JSON.stringify(body)); r.end();
  });
}
function get(path, hdrs) {
  return new Promise((res, rej) => {
    const r = http.request({hostname:'127.0.0.1',port:8788,path,method:'GET',headers:hdrs||{}}, x => { let d=''; x.on('data',c=>d+=c); x.on('end',()=>{try{res(JSON.parse(d))}catch(e){res(d)}}); });
    r.on('error',rej); r.end();
  });
}
function multipartPost(path, fieldName, filePath, token) {
  return new Promise((res, rej) => {
    const boundary = '----Boundary' + Date.now();
    const photoBuf = fs.readFileSync(filePath);
    const part1 = '--' + boundary + '\r\nContent-Disposition: form-data; name="' + fieldName + '"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n';
    const part2 = '\r\n--' + boundary + '--\r\n';
    const body = Buffer.concat([Buffer.from(part1,'utf8'), photoBuf, Buffer.from(part2,'utf8')]);
    const r = http.request({hostname:'127.0.0.1',port:8788,path,method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+boundary, 'Authorization':'Bearer '+token}}, x => { let d=''; x.on('data',c=>d+=c); x.on('end',()=>{try{res(JSON.parse(d))}catch(e){res(d)}}); });
    r.on('error',rej); r.end(body);
  });
}

(async() => {
  // Login
  await post('/api/auth/phone/send-code', {phone:'13900000001'});
  const codeR = await get('/api/debug/sms-code?phone=13900000001');
  const login = await post('/api/auth/phone/login', {phone:'13900000001', code: codeR.code});
  const sid = login.sessionId || login.token;
  console.log('Logged in, sid:', (sid||'').substring(0,12)+'...');

  // Upload photo for tier1 analysis
  console.log('Uploading photo for tier1 analysis...');
  const t1Result = await multipartPost('/api/tier1/analyze', 'photo', 'C:/Users/yao/Documents/ChatGPT/美妆app/test_face.jpg', sid);
  console.log('Tier1 result:', JSON.stringify(t1Result).substring(0,600));

  if (t1Result.reportId) {
    console.log('Tier1 report ID:', t1Result.reportId);
    
    // Now generate tier2 from this tier1
    console.log('Generating tier2...');
    const t2Gen = await post('/api/tier2/generate', {reportId: t1Result.tier2ReportId || t1Result.reportId}, {Authorization:'Bearer '+sid});
    console.log('Tier2 generate:', JSON.stringify(t2Gen).substring(0,300));
    
    // Poll status until ready
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      attempts++;
      const status = await get('/api/tier2/status?tier1ReportId=' + t1Result.reportId, {Authorization:'Bearer '+sid});
      console.log('Status attempt ' + attempts + ':', status.generationStatus);
      if (status.generationStatus === 'ready') {
        console.log('Tier2 ready! Report ID:', status.tier2ReportId);
        console.log('Content preview:', JSON.stringify(status.content).substring(0,400));
        // Save the tier2 report ID for screenshot
        fs.writeFileSync('C:/Users/yao/Documents/ChatGPT/美妆app/_tier2_report_id.txt', status.tier2ReportId);
        break;
      } else if (status.generationStatus === 'failed') {
        console.log('Tier2 generation failed');
        break;
      }
    }
  }
})().catch(e => console.error('ERROR:', e.message));