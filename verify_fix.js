const https = require('https');
const crypto = require('crypto');

function md5(s) { return crypto.createHash('md5').update(s).digest('hex').toUpperCase(); }

async function searchFull(kw, limit) {
  limit = limit || 10;
  var p = {
    app_key: '35375517', method: 'taobao.tbk.dg.material.optional.upgrade',
    timestamp: String(Math.floor(Date.now()/1000)), v: '2.0', sign_method: 'md5',
    q: kw, page_no: '1', page_size: String(limit),
    fields: 'num_iid,title,pict_url,small_images,resale_price,final_promotion_price,item_url,shop_title,seller_nick,coupon_info,click_url,short_title,brand_name,volume,user_type,zk_final_price',
    adzone_id: '116312800133'
  };
  var sk = Object.keys(p).sort();
  var ps = '3e45726cf39668b52c03d7f4d9e869d3';
  for (var i = 0; i < sk.length; i++) ps += sk[i] + p[sk[i]];
  ps += '3e45726cf39668b52c03d7f4d9e869d3';
  p.sign = md5(ps);
  var qs = Object.entries(p).map(function(e) { return e[0]+'='+encodeURIComponent(e[1]); }).join('&');
  return new Promise(function(resolve, reject) {
    https.get('https://eco.taobao.com/router/rest?'+qs, {headers:{'User-Agent':'BeautyApp/1.0'}}, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        var parse = function(tag) {
          var re = new RegExp('<'+tag+'>([^<]*)</'+tag+'>', 'g');
          var results = []; var m;
          while ((m = re.exec(data)) !== null) results.push(m[1]);
          return results;
        };
        var titles = parse('title'), prices = parse('zk_final_price'), imgs = parse('pict_url');
        var clicks = parse('click_url'), shops = parse('shop_title'), brands = parse('brand_name');
        resolve(titles.map(function(t, i) {
          return { title: t, price: parseFloat(prices[i]||'0'), image: imgs[i]||'', click: clicks[i]||'', shop: shops[i]||'', brand: brands[i]||'' };
        }));
      });
    }).on('error', reject);
  });
}

function isSample(title) {
  var kws = ["小样", "试用装", "中样", "体验装", "1ml", "2ml", "3ml", "5ml", "10ml", "0.5ml", "1.5ml", "30ml*3", "3支装", "5支装", "支装", "分装"];
  return kws.some(function(s) { return title.indexOf(s) !== -1; });
}

// Simulate the NEW findProductByKeyword logic with MIN_PRICE=50
function findProductNew(products, name) {
  var MIN_PRICE = 50;
  var MAX_PRICE = 2000;
  // First pass
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    if (p.price < MIN_PRICE || p.price > MAX_PRICE) continue;
    if (isSample(p.title)) continue;
    return p;
  }
  // Second pass (NEW: also filters samples)
  for (var i = 0; i < products.length; i++) {
    if (products[i].price < MIN_PRICE || products[i].price > MAX_PRICE) continue;
    if (isSample(products[i].title)) continue;
    return products[i];
  }
  return null;
}

async function main() {
  console.log('=== Testing NEW logic (MIN_PRICE=50, sample filter in 2nd pass) ===\n');
  
  console.log('[SK-II神仙水]');
  var r1 = await searchFull('SKII神仙水', 10);
  var result1 = findProductNew(r1, 'SKII神仙水');
  if (result1) {
    console.log('  SELECTED: ' + result1.title.substring(0, 50) + ' (¥' + result1.price + ')');
    console.log('  Sample?: ' + isSample(result1.title));
  } else {
    console.log('  NO MATCH - all results are samples or out of range');
  }
  
  console.log('\n[眉粉套装]');
  var r2 = await searchFull('眉粉套装', 10);
  var result2 = findProductNew(r2, '眉粉套装');
  if (result2) {
    console.log('  SELECTED: ' + result2.title.substring(0, 50) + ' (¥' + result2.price + ')');
    console.log('  Sample?: ' + isSample(result2.title));
    console.log('  Brand: ' + (result2.brand || 'NONE'));
  } else {
    console.log('  NO MATCH - all results are below ¥50 or samples');
  }
  
  console.log('\n[CT光影饼]');
  var r3 = await searchFull('CT光影饼', 5);
  var result3 = findProductNew(r3, 'CT光影饼');
  if (result3) {
    console.log('  SELECTED: ' + result3.title.substring(0, 50) + ' (¥' + result3.price + ')');
  } else {
    console.log('  NO MATCH');
  }
  
  console.log('\n=== Summary ===');
  console.log('SK-II: ' + (result1 ? 'Would show ¥' + result1.price + ' full-size product' : 'No result (all samples filtered)'));
  console.log('眉粉: ' + (result2 ? 'Would show ¥' + result2.price + ' product' : 'No result (all below ¥50)'));
  console.log('CT: ' + (result3 ? 'Would show ¥' + result3.price + ' product' : 'No result'));
}
main().catch(console.error);
