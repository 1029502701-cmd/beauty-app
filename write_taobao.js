const fs = require("fs");

const code = `/**
 * Taobao affiliate (AliMama) product search module
 * Uses taobao.tbk.dg.material.optional.upgrade API
 */

import type { Ctx } from './_utils';

export interface TaobaoProduct {
  itemId: string;
  title: string;
  imageUrl: string;
  price: number;
  itemUrl: string;
  shopTitle?: string;
  brandName?: string;
}

const CACHE_TTL = 24 * 60 * 60;
const MIN_PRICE = 20;

function md5FromString(message: string): string {
  function md5cycle(x, k) {
    var a = x[0], b = x[1], c = x[2], d = x[3];
    a = fn1(a,b,c,d,k[0],7,-680876936); d = fn1(d,a,b,c,k[1],12,-389564586);
    c = fn1(c,d,a,b,k[2],17,606105819); b = fn1(b,c,d,a,k[3],22,-1044525330);
    a = fn1(a,b,c,d,k[4],7,-176418897); d = fn1(d,a,b,c,k[5],12,1200080426);
    c = fn1(c,d,a,b,k[6],17,-1473231341); b = fn1(b,c,d,a,k[7],22,-45705983);
    a = fn1(a,b,c,d,k[8],7,1770035416); d = fn1(d,a,b,c,k[9],12,-1958414417);
    c = fn1(c,d,a,b,k[10],17,-42063); b = fn1(b,c,d,a,k[11],22,-1990404162);
    a = fn1(a,b,c,d,k[12],7,1804603682); d = fn1(d,a,b,c,k[13],12,-40341101);
    c = fn1(c,d,a,b,k[14],17,-1502002290); b = fn1(b,c,d,a,k[15],22,1236535329);
    a = fn2(a,b,c,d,k[1],5,-165796510); d = fn2(d,a,b,c,k[6],9,-1069501632);
    c = fn2(c,d,a,b,k[11],14,643717713); b = fn2(b,c,d,a,k[0],20,-373897302);
    a = fn2(a,b,c,d,k[5],5,-701558691); d = fn2(d,a,b,c,k[10],9,38016083);
    c = fn2(c,d,a,b,k[15],14,-660478335); b = fn2(b,c,d,a,k[4],20,-405537848);
    a = fn2(a,b,c,d,k[9],5,568446438); d = fn2(d,a,b,c,k[14],9,-1019803690);
    c = fn2(c,d,a,b,k[3],14,-187363961); b = fn2(b,c,d,a,k[8],20,1163531501);
    a = fn2(a,b,c,d,k[13],5,-1444681467); d = fn2(d,a,b,c,k[2],9,-51403784);
    c = fn2(c,d,a,b,k[7],14,1735328473); b = fn2(b,c,d,a,k[12],20,-1926607734);
    a = fn3(a,b,c,d,k[5],4,-378558); d = fn3(d,a,b,c,k[8],11,-2022574463);
    c = fn3(c,d,a,b,k[11],16,1839030562); b = fn3(b,c,d,a,k[14],23,-35309556);
    a = fn3(a,b,c,d,k[1],4,-1530992060); d = fn3(d,a,b,c,k[4],11,1272893353);
    c = fn3(c,d,a,b,k[7],16,-155497632); b = fn3(b,c,d,a,k[10],23,-1094730640);
    a = fn3(a,b,c,d,k[9],4,-640364487); d = fn3(d,a,b,c,k[12],11,-421815835);
    c = fn3(c,d,a,b,k[15],16,530742520); b = fn3(b,c,d,a,k[2],23,-995338651);
    a = fn4(a,b,c,d,k[0],6,-198630844); d = fn4(d,a,b,c,k[7],10,1126891415);
    c = fn4(c,d,a,b,k[14],15,-1416354905); b = fn4(b,c,d,a,k[5],21,-57434055);
    a = fn4(a,b,c,d,k[12],6,1700485571); d = fn4(d,a,b,c,k[3],10,-1894986606);
    c = fn4(c,d,a,b,k[10],15,-1051523); b = fn4(b,c,d,a,k[1],21,-2054922799);
    a = fn4(a,b,c,d,k[8],6,1873313359); d = fn4(d,a,b,c,k[15],10,-30611744);
    c = fn4(c,d,a,b,k[6],15,-1560198380); b = fn4(b,c,d,a,k[13],21,1309151649);
    a = fn4(a,b,c,d,k[4],6,-145523070); d = fn4(d,a,b,c,k[11],10,-1120210379);
    c = fn4(c,d,a,b,k[2],15,718787259); b = fn4(b,c,d,a,k[9],21,-343485551);
    x[0] = add32(a,x[0]); x[1] = add32(b,x[1]); x[2] = add32(c,x[2]); x[3] = add32(d,x[3]);
  }
  function str2binl(str) {
    var bin = [], mask = (1<<8)-1;
    for (var i = 0; i < str.length*8; i += 8) bin[i>>5] |= (str.charCodeAt(i/8) & mask) << (i%32);
    return bin;
  }
  function binl2hex(binarray) {
    var hex_chr = '0123456789abcdef', s = '';
    for (var n = 0; n < binarray.length*4; n++)
      s += hex_chr.charAt((binarray[n>>2] >> ((n%4)*8+4)) & 0xf) +
           hex_chr.charAt((binarray[n>>2] >> ((n%4)*8)) & 0xf);
    return s;
  }
  function cmn(q,a,b,x,s,t) { a = add32(add32(a,q),add32(x,t)); return add32((a<<s)|(a>>>(32-s)),b); }
  function fn1(a,b,c,d,x,s,t) { return cmn((b&c)|((~b)&d),a,b,x,s,t); }
  function fn2(a,b,c,d,x,s,t) { return cmn((b&d)|(c&(~d)),a,b,x,s,t); }
  function fn3(a,b,c,d,x,s,t) { return cmn(b^c^d,a,b,x,s,t); }
  function fn4(a,b,c,d,x,s,t) { return cmn(c^(b|(~d)),a,b,x,s,t); }
  function add32(a,b) { return (a+b)&0xFFFFFFFF; }
  var x = str2binl(message), len = message.length;
  x[len>>5] |= 0x80 << (len%32*8);
  x[(((len+64)>>>9)<<4)+14] = len*8;
  var A=0x67452301, B=0xefcdab89, C=0x98badcfe, D=0x10325476;
  for (var k = 0; k < x.length; k += 16) {
    var aaa=A,bbb=B,ccc=C,ddd=D, kk=x.slice(k,k+16);
    A=fn1(A,B,C,D,kk[0],7,-680876936); D=fn1(D,A,B,C,kk[1],12,-389564586);
    C=fn1(C,D,A,B,kk[2],17,606105819); B=fn1(B,C,D,A,kk[3],22,-1044525330);
    A=fn1(A,B,C,D,kk[4],7,-176418897); D=fn1(D,A,B,C,kk[5],12,1200080426);
    C=fn1(C,D,A,B,kk[6],17,-1473231341); B=fn1(B,C,D,A,kk[7],22,-45705983);
    A=fn1(A,B,C,D,kk[8],7,1770035416); D=fn1(D,A,B,C,kk[9],12,-1958414417);
    C=fn1(C,D,A,B,kk[10],17,-42063);   B=fn1(B,C,D,A,kk[11],22,-1990404162);
    A=fn1(A,B,C,D,kk[12],7,1804603682); D=fn1(D,A,B,C,kk[13],12,-40341101);
    C=fn1(C,D,A,B,kk[14],17,-1502002290); B=fn1(B,C,D,A,kk[15],22,1236535329);
    A=fn2(A,B,C,D,kk[1],5,-165796510); D=fn2(D,A,B,C,kk[6],9,-1069501632);
    C=fn2(C,D,A,B,kk[11],14,643717713); B=fn2(B,C,D,A,kk[0],20,-373897302);
    A=fn2(A,B,C,D,kk[5],5,-701558691); D=fn2(D,A,B,C,kk[10],9,38016083);
    C=fn2(C,D,A,B,kk[15],14,-660478335); B=fn2(B,C,D,A,kk[4],20,-405537848);
    A=fn2(A,B,C,D,kk[9],5,568446438); D=fn2(D,A,B,C,kk[14],9,-1019803690);
    C=fn2(C,D,A,B,kk[3],14,-187363961); B=fn2(B,C,D,A,kk[8],20,1163531501);
    A=fn2(A,B,C,D,kk[13],5,-1444681467); D=fn2(D,A,B,C,kk[2],9,-51403784);
    C=fn2(C,D,A,B,kk[7],14,1735328473); B=fn2(B,C,D,A,kk[12],20,-1926607734);
    A=fn3(A,B,C,D,kk[5],4,-378558); D=fn3(D,A,B,C,kk[8],11,-2022574463);
    C=fn3(C,D,A,B,kk[11],16,1839030562); B=fn3(B,C,D,A,kk[14],23,-35309556);
    A=fn3(A,B,C,D,kk[1],4,-1530992060); D=fn3(D,A,B,C,kk[4],11,1272893353);
    C=fn3(C,D,A,B,kk[7],16,-155497632); B=fn3(B,C,D,A,kk[10],23,-1094730640);
    A=fn3(A,B,C,D,kk[9],4,-640364487); D=fn3(D,A,B,C,kk[12],11,-421815835);
    C=fn3(C,D,A,B,kk[15],16,530742520); B=fn3(B,C,D,A,kk[2],23,-995338651);
    A=fn4(A,B,C,D,kk[0],6,-198630844); D=fn4(D,A,B,C,kk[7],10,1126891415);
    C=fn4(C,D,A,B,kk[14],15,-1416354905); B=fn4(B,C,D,A,kk[5],21,-57434055);
    A=fn4(A,B,C,D,kk[12],6,1700485571); D=fn4(D,A,B,C,kk[3],10,-1894986606);
    C=fn4(C,D,A,B,kk[10],15,-1051523);  B=fn4(B,C,D,A,kk[1],21,-2054922799);
    A=fn4(A,B,C,D,kk[8],6,1873313359); D=fn4(D,A,B,C,kk[15],10,-30611744);
    C=fn4(C,D,A,B,kk[6],15,-1560198380); B=fn4(B,C,D,A,kk[13],21,1309151649);
    A=fn4(A,B,C,D,kk[4],6,-145523070); D=fn4(D,A,B,C,kk[11],10,-1120210379);
    C=fn4(C,D,A,B,kk[2],15,718787259);  B=fn4(B,C,D,A,kk[9],21,-343485551);
    A=(A+aaa)|0; B=(B+bbb)|0; C=(C+ccc)|0; D=(D+ddd)|0;
  }
  return binl2hex([A,B,C,D]);
}

function buildSign(appSecret, params) {
  var sortedKeys = Object.keys(params).sort();
  var preSign = appSecret;
  for (var i = 0; i < sortedKeys.length; i++) preSign += sortedKeys[i] + params[sortedKeys[i]];
  preSign += appSecret;
  return md5FromString(preSign).toUpperCase();
}

export async function searchTaobaoProducts(keyword, env, limit = 10) {
  var appKey = env.TAOBAO_APP_KEY;
  var appSecret = env.TAOBAO_APP_SECRET;
  var pid = env.TAOBAO_PID || '';
  var adzoneMatch = pid.match(/_(\\d+)$/);
  var adzoneId = adzoneMatch ? adzoneMatch[1] : '';
  if (!appKey || !appSecret) { console.warn('[taobao] TAOBAO_APP_KEY or TAOBAO_APP_SECRET not configured'); return []; }
  var cacheKey = 'tb:' + keyword.substring(0, 50);
  try {
    var cached = await env.SESSION_KV.get(cacheKey, 'json');
    if (cached) { console.log('[taobao] Cache hit for ' + keyword); return cached; }
  } catch (e) { console.warn('[taobao] Cache read error:', e); }
  try {
    var timestamp = String(Math.floor(Date.now() / 1000));
    var params = {
      app_key: appKey,
      method: 'taobao.tbk.dg.material.optional.upgrade',
      timestamp: timestamp,
      v: '2.0',
      sign_method: 'md5',
      q: keyword,
      page_no: '1',
      page_size: String(limit),
      fields: 'num_iid,title,pict_url,small_images,resale_price,final_promotion_price,item_url,shop_title,seller_nick,coupon_info,click_url,short_title,brand_name,volume,user_type,zk_final_price',
    };
    if (adzoneId) params.adzone_id = adzoneId;
    var sign = buildSign(appSecret, params);
    var url = new URL('https://eco.taobao.com/router/rest');
    Object.entries(params).forEach(function(e) { url.searchParams.set(e[0], e[1]); });
    url.searchParams.set('sign', sign);
    console.log('[taobao] Fetching ' + keyword + ' -> ' + url.toString().slice(0, 120));
    var resp = await fetch(url.toString(), { headers: {'User-Agent': 'BeautyApp/1.0'}, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) { console.error('[taobao] API HTTP error ' + resp.status); return []; }
    var xmlText = await resp.text();
    var products = parseTaobaoXml(xmlText);
    if (products.length > 0) {
      try { await env.SESSION_KV.put(cacheKey, JSON.stringify(products), { expirationTtl: CACHE_TTL }); console.log('[taobao] Cached ' + products.length + ' for ' + keyword); }
      catch (e) { console.warn('[taobao] Cache write error:', e); }
    }
    return products;
  } catch (e) { console.error('[taobao] Search error for ' + keyword + ':', e); return []; }
}

function parseTaobaoXml(xmlText) {
  try {
    // Regex-based XML parsing (DOMParser not available in Cloudflare Workers)
    var errMatch = xmlText.match(/<error_response>[\\s\\S]*?<code>([^<]*)<\\/code>[\\s\\S]*?<msg>([^<]*)<\\/msg>/);
    if (errMatch) {
      console.warn('[taobao] API error: code=' + errMatch[1] + ', msg=' + errMatch[2]);
      return [];
    }
    var itemRegex = /<item_basic_info>([\\s\\S]*?)<\\/item_basic_info>/g;
    var products = [];
    var itemMatch;
    while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
      var itemXml = itemMatch[1];
      var getText = function(tag) {
        var m = itemXml.match('<' + tag + '>([^<]*)<\\/' + tag + '>');
        return m ? m[1] : '';
      };
      var numIid = getText('num_iid');
      var title = getText('title');
      var pictUrl = getText('pict_url');
      var zkFinalPrice = getText('zk_final_price');
      var resalePrice = getText('resale_price');
      var itemUrl = getText('item_url');
      var clickUrl = getText('click_url');
      var shopTitle = getText('shop_title');
      var brandName = getText('brand_name');
      var smallImgMatches = itemXml.matchAll(/<small_images>[\\s\\S]*?<string>([^<]*)<\\/string>/g);
      var smallImages = [];
      var sm;
      while ((sm = smallImgMatches.next()) && !sm.done) smallImages.push(sm.value[1]);
      var imageUrl = pictUrl || (smallImages[0] || '');
      var finalUrl = clickUrl || itemUrl;
      var fullUrl = finalUrl ? (finalUrl.startsWith('http') ? finalUrl : 'https:' + finalUrl) : '';
      if (!numIid && !title) continue;
      products.push({
        itemId: numIid, title: title, imageUrl: imageUrl,
        price: isNaN(parseFloat(zkFinalPrice || resalePrice || '0')) ? 0 : parseFloat(zkFinalPrice || resalePrice || '0'),
        itemUrl: fullUrl, shopTitle: shopTitle || undefined, brandName: brandName || undefined,
      });
    }
    return products;
  } catch (e) { console.error('[taobao] XML parse error:', e); return []; }
}

export async function findProductByKeyword(productName, env) {
  if (!productName || productName.trim().length < 2) return null;
  var products = await searchTaobaoProducts(productName.trim(), env, 10);
  if (products.length === 0) return null;
  var name = productName.trim();
  var triedAlt = false;
  while (true) {
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      var isMatch = p.title.includes(name) || name.includes(p.title.substring(0, 4));
      if (!isMatch) continue;
      if (p.price < MIN_PRICE) {
        console.log('[taobao] Price filter: ' + p.title.substring(0, 30) + ' (yuan' + p.price + ')');
        continue;
      }
      var samplePatterns = ['\\u5c0f\\u6837', '\\u8bd5\\u7528\\u88c5', '\\u4e2d\\u6837', '\\u4f53\\u9a8c\\u88c5', '1ml', '2ml', '3ml', '5ml', '10ml'];
      var isSample = false;
      for (var j = 0; j < samplePatterns.length; j++) {
        if (p.title.indexOf(samplePatterns[j]) !== -1) { isSample = true; break; }
      }
      if (isSample) {
        console.log('[taobao] Sample filter: ' + p.title.substring(0, 30));
        continue;
      }
      console.log('[taobao] Selected: ' + p.title.substring(0, 40) + ' (yuan' + p.price + ')');
      return p;
    }
    if (!triedAlt) {
      triedAlt = true;
      console.log('[taobao] Retrying with \\u6b63\\u88c5 suffix for: ' + name);
      products = await searchTaobaoProducts(name + ' \\u6b63\\u88c5', env, 10);
      if (products.length === 0) break;
    } else {
      break;
    }
  }
  console.log('[taobao] No valid match for: ' + name);
  return null;
}
`;

fs.writeFileSync("pages-functions/functions/api/_taobao.ts", code);
console.log("Written", code.length, "bytes");
