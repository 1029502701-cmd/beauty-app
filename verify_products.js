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

// Check if product title contains sample keywords
function isSample(title) {
  var kws = ['小样', '试用装', '中样', '体验装', '1ml', '2ml', '3ml', '5ml', '10ml', '0.5ml', '1.5ml', '30ml*3', '3支装', '5支装'];
  return kws.some(function(s) { return title.indexOf(s) !== -1; });
}

async function main() {
  console.log('=== 1. SK-II神仙水 搜索结果分析 ===');
  var r1 = await searchFull('SKII神仙水', 10);
  console.log('Total results: ' + r1.length);
  var valid = [], samples = [], noBrand = [];
  for (var i = 0; i < r1.length; i++) {
    var p = r1[i];
    var entry = { idx: i+1, title: p.title, price: p.price, brand: p.brand, shop: p.shop };
    if (p.price >= 30 && p.price <= 2000) {
      if (isSample(p.title)) { samples.push(entry); entry.flag = 'SAMPLE-BUT-PASS-PRICE'; }
      else { valid.push(entry); entry.flag = 'VALID'; }
    } else {
      entry.flag = 'OUT-OF-RANGE';
    }
    console.log('  #' + (i+1) + ' [' + p.price + '元] ' + (entry.flag) + ' | ' + p.title.substring(0, 50));
  }
  console.log('Valid full-size: ' + valid.length + ', Samples that passed price filter: ' + samples.length);
  if (samples.length > 0) {
    console.log('  SAMPLES (should be filtered but pass 2nd pass):');
    samples.forEach(s => console.log('    ¥' + s.price + ': ' + s.title.substring(0,60)));
  }

  console.log('\n=== 2. 眉粉套装 搜索结果分析 ===');
  var r2 = await searchFull('眉粉套装', 10);
  console.log('Total results: ' + r2.length);
  var valid2 = [], samples2 = [], noBrand2 = [];
  for (var i = 0; i < r2.length; i++) {
    var p = r2[i];
    var entry = { idx: i+1, title: p.title, price: p.price, brand: p.brand, shop: p.shop };
    if (p.price >= 30 && p.price <= 2000) {
      if (isSample(p.title)) { samples2.push(entry); entry.flag = 'SAMPLE'; }
      else { valid2.push(entry); entry.flag = 'VALID'; }
    } else {
      entry.flag = 'OUT-OF-RANGE';
    }
    if (!p.brand) entry.flag += ' NO-BRAND';
    console.log('  #' + (i+1) + ' [' + p.price + '元] ' + entry.flag + ' | brand=' + (p.brand||'NONE') + ' | ' + p.title.substring(0, 50));
  }

  console.log('\n=== 3. 检查 MIN_PRICE=30 过滤逻辑 ===');
  console.log('Products < 30元被第一遍过滤跳过，但第二遍仍可能选中');
  console.log('眉粉套装最低价 ¥7.9 共 ' + r2.filter(function(p){return p.price<30;}).length + ' 条(<¥30)');
  console.log('SK-II神仙水最低价 ¥30.4 共 ' + r1.filter(function(p){return p.price<50;}).length + ' 条(<¥50)');

  console.log('\n=== 4. 更精确搜索: SKII神仙水 正装 ===');
  var r4 = await searchFull('SKII神仙水 正装 230ml', 5);
  for (var i = 0; i < r4.length; i++) {
    var p = r4[i];
    console.log('  #' + (i+1) + ' [' + p.price + '元] ' + (isSample(p.title)?'SAMPLE':'VALID') + ' | ' + p.title.substring(0, 60));
  }
}
main().catch(console.error);
