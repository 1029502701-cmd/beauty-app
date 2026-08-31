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
        var volumes = parse('volume');
        resolve(titles.map(function(t, i) {
          return { title: t, price: parseFloat(prices[i]||'0'), image: imgs[i]||'', click: clicks[i]||'', shop: shops[i]||'', brand: brands[i]||'', volume: volumes[i]||'' };
        }));
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== SK-II神仙水 (top 5) ===');
  var r1 = await searchFull('SKII神仙水', 5);
  for (var i = 0; i < r1.length; i++) {
    console.log((i+1)+'. ['+r1[i].price+'元] '+r1[i].title.substring(0,55));
    console.log('    shop='+r1[i].shop+' brand='+r1[i].brand+' vol='+r1[i].volume);
  }

  console.log('\n=== 眉粉套装 (top 5) ===');
  var r2 = await searchFull('眉粉套装', 5);
  for (var i = 0; i < r2.length; i++) {
    console.log((i+1)+'. ['+r2[i].price+'元] '+r2[i].title.substring(0,55));
    console.log('    shop='+r2[i].shop+' brand='+r2[i].brand);
  }

  console.log('\n=== CT光影饼 (top 5) ===');
  var r3 = await searchFull('CT光影饼', 5);
  for (var i = 0; i < r3.length; i++) {
    console.log((i+1)+'. ['+r3[i].price+'元] '+r3[i].title.substring(0,55));
    console.log('    shop='+r3[i].shop+' brand='+r3[i].brand);
  }

  console.log('\n=== 更精确: \"SKII神仙水 正装\" ===');
  var r4 = await searchFull('SKII神仙水 正装', 5);
  for (var i = 0; i < r4.length; i++) {
    console.log((i+1)+'. ['+r4[i].price+'元] '+r4[i].title.substring(0,55));
    console.log('    shop='+r4[i].shop);
  }

  console.log('\n=== 更精确: \"兰蔻小黑瓶 正装\" ===');
  var r5 = await searchFull('兰蔻小黑瓶 正装', 5);
  for (var i = 0; i < Math.min(3, r5.length); i++) {
    console.log((i+1)+'. ['+r5[i].price+'元] '+r5[i].title.substring(0,55));
    console.log('    shop='+r5[i].shop);
  }
}
main().catch(console.error);
