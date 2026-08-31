const crypto = require('crypto');
async function md5(str) { return crypto.createHash('md5').update(str).digest('hex').toUpperCase(); }
async function test(keyword) {
  const appKey = '35375517';
  const appSecret = '3e45726cf39668b52c03d7f4d9e869d3';
  const ts = String(Math.floor(Date.now()/1000));
  const params = { app_key:appKey, method:'taobao.tbk.dg.material.optional.upgrade', timestamp:ts, v:'2.0', sign_method:'md5', q:keyword, page_no:'1', page_size:'5', fields:'num_iid,title,pict_url,zk_final_price,click_url,shop_title,brand_name' };
  const sorted = Object.keys(params).sort();
  let pre = appSecret;
  for (const k of sorted) pre += k + params[k];
  pre += appSecret;
  params.sign = await md5(pre);
  const url = new URL('https://eco.taobao.com/router/rest');
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v);
  console.log('Querying:', keyword);
  const resp = await fetch(url.toString(), {headers:{'User-Agent':'BeautyApp/1.0'}, signal: AbortSignal.timeout(15000)});
  const text = await resp.text();
  if (text.includes('<error_response>')) { console.log('API Error:', text.substring(0,300)); return; }
  const titles = text.match(/<title>([^<]*)<\/title>/g) || [];
  const prices = text.match(/<zk_final_price>([^<]*)<\/zk_final_price>/g) || [];
  const imgs = text.match(/<pict_url>([^<]*)<\/pict_url>/g) || [];
  console.log('Found', titles.length, 'products');
  for (let i = 0; i < Math.min(3, titles.length); i++) {
    const t = titles[i].replace(/<title>|<\/title>/g, '');
    const p = prices[i] ? prices[i].replace(/<zk_final_price>|<\/zk_final_price>/g, '') : 'N/A';
    const img = imgs[i] ? imgs[i].replace(/<pict_url>|<\/pict_url>/g, '') : 'N/A';
    console.log('  ' + (i+1) + '. ' + t.substring(0,60) + ' | price=' + p + ' | img=' + img.substring(0,80));
  }
}
(async () => {
  await test('Fenty Beauty ÐÞÈÝ°ô');
  await test('NARS ÐÞÈÝ·Û');
  await test('MAC ¸ß¹â');
})();
