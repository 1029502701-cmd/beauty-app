const fetch = require('node-fetch');
(async () => {
  // Test GET to /api/tier1/analyze
  const r1 = await fetch('https://6fd44d11.beauty-api-pages.pages.dev/api/tier1/analyze', {method:'GET'});
  const t1 = await r1.text();
  console.log('GET /api/tier1/analyze:', r1.status, 'len=' + t1.length, 'starts=' + t1.substring(0,50));
  
  // Test POST to /api/tier1/analyze
  const r2 = await fetch('https://6fd44d11.beauty-api-pages.pages.dev/api/tier1/analyze', {
    method: 'POST',
    headers: {'Content-Type':'application/json','Authorization':'Bearer test'},
    body: JSON.stringify({imageData:'data:image/png;base64,iVBORw0KGgo='})
  });
  const t2 = await r2.text();
  console.log('POST /api/tier1/analyze:', r2.status, 'server=' + r2.headers.get('server'), 'body=' + t2.substring(0,200));
  
  // Test homepage JS
  const r3 = await fetch('https://6fd44d11.beauty-api-pages.pages.dev/');
  const t3 = await r3.text();
  const js = t3.match(/index-([A-Za-z0-9]+)\\.js/);
  console.log('Homepage JS:', js ? js[0] : 'not found');
})();
