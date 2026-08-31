const BASE = 'http://localhost:8788';
(async () => {
  const token = '4d138609-c69d-4bb3-91fc-a284f17470cb';
  const r = await fetch(BASE + '/api/reports/mine', { headers: { 'Authorization': 'Bearer ' + token } });
  const d = await r.json();
  const t2 = d.reports.find(r => r.tier === 2);
  if (!t2) { console.log('No tier2 report'); return; }
  const c = typeof t2.content === 'string' ? JSON.parse(t2.content) : t2.content;
  const pr = c.productRecs;
  console.log('productRecs keys:', Object.keys(pr));
  for (const [k, v] of Object.entries(pr)) {
    console.log(k + ':', JSON.stringify(v).substring(0, 300));
  }
  console.log('\n--- Full productRecs ---');
  console.log(JSON.stringify(pr, null, 2));
})();
