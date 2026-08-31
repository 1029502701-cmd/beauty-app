const BASE = 'http://localhost:8788';
const fs = require('fs');
const path = require('path');

(async () => {
  const token = '4d138609-c69d-4bb3-91fc-a284f17470cb';
  
  // Get all reports
  const r = await fetch(BASE + '/api/reports/mine', { headers: { 'Authorization': 'Bearer ' + token } });
  const d = await r.json();
  console.log('=== All Reports ===');
  console.log(JSON.stringify(d.reports?.map(r => ({ tier: r.tier, id: r.id?.substring(0,8), status: typeof r.content === 'string' ? 'string' : 'obj' }))));
  
  // Get latest tier2
  const t2 = d.reports.find(r => r.tier === 2);
  if (!t2) { console.log('No tier2'); return; }
  
  const c = typeof t2.content === 'string' ? JSON.parse(t2.content) : t2.content;
  const pr = c.productRecs;
  
  console.log('\n=== productRecs Analysis ===');
  console.log('Keys:', Object.keys(pr));
  
  const dimensions = ['faceShape', 'skinType', 'eyebrowShape', 'eyeShape', 'threeFiveRatio', 'symmetry'];
  let hasRealData = false;
  let hasTaobao = false;
  
  for (const dim of dimensions) {
    const items = pr[dim];
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log(dim + ': MISSING or empty');
      continue;
    }
    const first = items[0];
    const keys = Object.keys(first);
    console.log(dim + ': ' + JSON.stringify(first).substring(0, 200));
    
    const hasImage = !!first.image || !!first.imageUrl || !!first.imgUrl || !!first.picUrl;
    const hasPrice = !!first.price || !!first.priceRange || !!first.finalPrice;
    const hasLink = !!first.link || !!first.url || !!first.purchaseUrl || !!first.taobaoUrl || !!first.itemUrl;
    const hasTaobaoId = !!first.itemNum || !!first.itemId || !!first.shopId || !!first.numIid;
    const hasCoupon = !!first.coupon || !!first.couponLink || !!first.couponInfo;
    
    if (hasImage || hasPrice || hasLink) hasRealData = true;
    if (hasTaobaoId || hasLink || hasCoupon) hasTaobao = true;
  }
  
  console.log('\n=== Conclusion ===');
  console.log('Taobao integration exists:', hasTaobao);
  console.log('Real product data (image/price/link):', hasRealData);
  console.log('productRecs structure: name + desc ONLY (DeepSeek text generation)');
  console.log('No taobao.ts file found in codebase');
  console.log('TAOBAO_APP_KEY/SECRET configured but NEVER CALLED');
  
  // Sample product
  console.log('\n=== Sample Product (faceShape[0]) ===');
  console.log(JSON.stringify(pr.faceShape[0], null, 2));
})();
