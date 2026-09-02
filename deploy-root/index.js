var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/_taobao.ts
var CACHE_TTL = 24 * 60 * 60;
var MIN_PRICE = 50;
var MAX_PRICE = 2e3;
var CATEGORY_PRICE_RANGES = {
  "\u53E3\u7EA2": [20, 150],
  "\u5507\u91C9": [20, 150],
  "\u5507\u5F69": [20, 150],
  "\u5507\u818F": [20, 150],
  "\u773C\u5F71": [20, 150],
  "\u773C\u5F71\u76D8": [20, 150],
  "\u9AD8\u5149": [20, 150],
  "\u4FEE\u5BB9": [20, 150],
  "\u4FEE\u5BB9\u68D2": [20, 150],
  "\u4FEE\u5BB9\u76D8": [20, 150],
  "\u9634\u5F71": [20, 150],
  "\u7709\u7B14": [20, 150],
  "\u7709\u7C89": [20, 150],
  "\u7709\u6BDB\u818F": [20, 150],
  "\u7709\u80F6": [20, 150],
  "\u773C\u7EBF": [20, 150],
  "\u773C\u7EBF\u7B14": [20, 150],
  "\u773C\u7EBF\u6DB2": [20, 150],
  "\u773C\u7EBF\u818F": [20, 150],
  "\u816E\u7EA2": [20, 150],
  "\u7C89\u5E95\u6DB2": [30, 200],
  "\u7C89\u5E95": [30, 200],
  "\u6C14\u57AB": [30, 200],
  "\u6C14\u57ABBB": [30, 200],
  "\u6C14\u57ABCC": [30, 200],
  "\u7C89\u997C": [30, 200],
  "\u6563\u7C89": [30, 200],
  "\u5B9A\u5986": [30, 200],
  "\u906E\u7455": [30, 200],
  "\u906E\u7455\u818F": [30, 200],
  "\u5986\u524D\u4E73": [30, 200],
  "\u9694\u79BB": [30, 200],
  "\u9762\u971C": [30, 250],
  "\u4E73\u6DB2": [30, 250],
  "\u723D\u80A4\u6C34": [30, 250],
  "\u5316\u5986\u6C34": [30, 250],
  "\u7CBE\u534E\u6C34": [30, 250],
  "\u4FDD\u6E7F\u4E73": [30, 250],
  "\u4FDD\u6E7F\u971C": [30, 250],
  "\u6D01\u9762": [30, 250],
  "\u6D17\u9762\u5976": [30, 250],
  "\u5378\u5986": [30, 250],
  "\u5378\u5986\u6C34": [30, 250],
  "\u5378\u5986\u6CB9": [30, 250],
  "\u9632\u6652": [30, 250],
  "\u9632\u6652\u971C": [30, 250],
  "\u7CBE\u534E": [50, 350],
  "\u7CBE\u534E\u6DB2": [50, 350],
  "\u539F\u6DB2": [50, 350],
  "\u773C\u971C": [50, 350],
  "\u773C\u90E8\u7CBE\u534E": [50, 350],
  "\u773C\u80F6": [50, 350],
  "\u5B89\u74F6": [50, 350],
  "\u808C\u5E95\u6DB2": [50, 350],
  "\u776B\u6BDB\u818F": [20, 150],
  "\u776B\u6BDB": [20, 150]
};
async function md5FromString(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
__name(md5FromString, "md5FromString");
async function buildSign(appSecret, params) {
  var sortedKeys = Object.keys(params).sort();
  var preSign = appSecret;
  for (var i = 0; i < sortedKeys.length; i++) preSign += sortedKeys[i] + params[sortedKeys[i]];
  preSign += appSecret;
  return (await md5FromString(preSign)).toUpperCase();
}
__name(buildSign, "buildSign");
function parseTaobaoXml(xmlText) {
  try {
    var errIdx = xmlText.indexOf("<error_response>");
    if (errIdx !== -1) {
      var codeMatch = xmlText.substring(errIdx).match(/<code>([^<]*)<\/code>/);
      var msgMatch = xmlText.substring(errIdx).match(/<msg>([^<]*)<\/msg>/);
      console.warn("[taobao] API error: code=" + (codeMatch ? codeMatch[1] : "?") + ", msg=" + (msgMatch ? msgMatch[1] : "?"));
      return [];
    }
    var products = [];
    var itemRegex = /<item_basic_info>([\s\S]*?)<\/item_basic_info>[\s\S]*?<item_id>([^<]*)<\/item_id>[\s\S]*?<price_promotion_info>[\s\S]*?<zk_final_price>([^<]*)<\/zk_final_price>[\s\S]*?<\/price_promotion_info>[\s\S]*?<publish_info>[\s\S]*?<click_url>([^<]*)<\/click_url>/g;
    var match2;
    while ((match2 = itemRegex.exec(xmlText)) !== null) {
      var itemXml = match2[1];
      var numIid = match2[2];
      var zkFinalPrice = match2[3];
      var clickUrl = match2[4];
      var getText = /* @__PURE__ */ __name(function(tag) {
        var t = "<" + tag + ">";
        var e = "</" + tag + ">";
        var si = itemXml.indexOf(t);
        if (si === -1) return "";
        var se = itemXml.indexOf(e, si + t.length);
        if (se === -1) return "";
        return itemXml.substring(si + t.length, se);
      }, "getText");
      var title = getText("title");
      var pictUrl = getText("pict_url");
      var shopTitle = getText("shop_title");
      var brandName = getText("brand_name");
      var smallImages = [];
      var siStart = itemXml.indexOf("<small_images>");
      if (siStart !== -1) {
        var siEnd = itemXml.indexOf("</small_images>", siStart);
        if (siEnd !== -1) {
          var imgRegex = /<string>([^<]*)<\/string>/g;
          var imgMatch;
          while ((imgMatch = imgRegex.exec(itemXml.substring(siStart, siEnd))) !== null) {
            smallImages.push(imgMatch[1]);
          }
        }
      }
      var imageUrl = pictUrl || (smallImages[0] || "");
      var fullUrl = clickUrl ? clickUrl.startsWith("http") ? clickUrl : "https:" + clickUrl : "";
      if (!numIid && !title) continue;
      products.push({
        itemId: numIid,
        title,
        imageUrl,
        price: isNaN(parseFloat(zkFinalPrice || "0")) ? 0 : parseFloat(zkFinalPrice || "0"),
        itemUrl: fullUrl,
        shopTitle: shopTitle || void 0,
        brandName: brandName || void 0
      });
    }
    return products;
  } catch (e) {
    console.error("[taobao] XML parse error:", e);
    return [];
  }
}
__name(parseTaobaoXml, "parseTaobaoXml");
var BRAND_CATEGORY_MAP = {
  "fenty": ["\u4FEE\u5BB9\u68D2", "\u7C89\u5E95\u6DB2", "\u9AD8\u5149", "\u816E\u7EA2"],
  "charlotte tilbury": ["\u773C\u5F71\u76D8", "\u6563\u7C89", "\u7C89\u5E95", "\u53E3\u7EA2"],
  "clinique": ["\u4FDD\u6E7F\u4E73", "\u9762\u971C", "\u7CBE\u534E", "\u6D01\u9762"],
  "la roche-posay": ["\u4FDD\u6E7F\u4E73", "\u7CBE\u534E", "\u6D01\u9762", "\u9632\u6652"],
  "urban decay": ["\u773C\u5F71\u76D8", "\u5B9A\u5986\u55B7\u96FE", "\u773C\u7EBF"],
  "heroine make": ["\u773C\u7EBF\u6DB2", "\u773C\u7EBF\u7B14", "\u7709\u6BDB\u818F"],
  "mac": ["\u4FEE\u5BB9\u76D8", "\u53E3\u7EA2", "\u7C89\u5E95", "\u816E\u7EA2"],
  "dior": ["\u9AD8\u5149", "\u53E3\u7EA2", "\u7C89\u5E95", "\u6563\u7C89"],
  "nars": ["\u906E\u7455\u818F", "\u816E\u7EA2", "\u53E3\u7EA2", "\u6563\u7C89"],
  "benefit": ["\u7709\u6BDB\u818F", "\u7709\u7B14", "\u5986\u524D\u4E73", "\u6563\u7C89"],
  "tarte": ["\u906E\u7455\u818F", "\u816E\u7EA2", "\u7C89\u5E95"],
  "anastasia": ["\u7709\u7B14", "\u7709\u7C89", "\u7709\u6BDB\u818F"],
  "sk-ii": ["\u795E\u4ED9\u6C34", "\u62A4\u80A4\u7CBE\u534E", "\u9762\u971C"],
  "maybelline": ["\u776B\u6BDB\u818F", "\u7C89\u5E95\u6DB2", "\u53E3\u7EA2", "\u7709\u7B14"],
  "shiseido": ["\u7C89\u5E95\u6DB2", "\u7CBE\u534E", "\u9762\u971C", "\u9632\u6652"],
  "larocheposay": ["\u4FDD\u6E7F\u4E73", "\u7CBE\u534E", "\u6D01\u9762", "\u9632\u6652"]
};
function extractBrand(productName) {
  var name = productName.trim().toLowerCase();
  var normalised = name.replace(/[\s\-]+/g, "");
  for (var key of Object.keys(BRAND_CATEGORY_MAP)) {
    var keyNormalised = key.replace(/[\s\-]+/g, "");
    if (normalised.includes(keyNormalised)) return key;
  }
  return null;
}
__name(extractBrand, "extractBrand");
function detectCategory(productName) {
  if (!productName) return null;
  var name = productName.trim();
  for (var cat of Object.keys(CATEGORY_PRICE_RANGES)) {
    if (name.includes(cat)) return cat;
  }
  var nameLower = name.toLowerCase();
  var enKeywordMap = {
    "contour": "\u4FEE\u5BB9",
    "contouring": "\u4FEE\u5BB9",
    "bronzer": "\u4FEE\u5BB9",
    "blush": "\u816E\u7EA2",
    "eyeshadow": "\u773C\u5F71",
    "shadow palette": "\u773C\u5F71\u76D8",
    "highlight": "\u9AD8\u5149",
    "highlighter": "\u9AD8\u5149",
    "brow": "\u7709\u7B14",
    "eyebrow": "\u7709\u7B14",
    "brow pencil": "\u7709\u7B14",
    "brow powder": "\u7709\u7C89",
    "brow gel": "\u7709\u6BDB\u818F",
    "eyeliner": "\u773C\u7EBF",
    "liner": "\u773C\u7EBF",
    "mascara": "\u776B\u6BDB\u818F",
    "lash": "\u776B\u6BDB\u818F",
    "foundation": "\u7C89\u5E95\u6DB2",
    "base": "\u7C89\u5E95\u6DB2",
    "primer": "\u5986\u524D\u4E73",
    "setting spray": "\u5B9A\u5986",
    "settingpowder": "\u6563\u7C89",
    "powder": "\u6563\u7C89",
    "concealer": "\u906E\u7455",
    "serum": "\u7CBE\u534E",
    "moisturizer": "\u9762\u971C",
    "cream": "\u9762\u971C",
    "lotion": "\u4E73\u6DB2",
    "cleanser": "\u6D01\u9762",
    "face wash": "\u6D01\u9762",
    "sunscreen": "\u9632\u6652",
    "spf": "\u9632\u6652",
    "lip": "\u53E3\u7EA2",
    "lipstick": "\u53E3\u7EA2",
    "lip gloss": "\u5507\u91C9",
    "eye cream": "\u773C\u971C",
    "eye serum": "\u773C\u90E8\u7CBE\u534E"
  };
  for (var enKey of Object.keys(enKeywordMap)) {
    if (nameLower.includes(enKey.toLowerCase())) {
      return enKeywordMap[enKey];
    }
  }
  return null;
}
__name(detectCategory, "detectCategory");
function getPriceRangeForCategory(category) {
  if (!category) return null;
  return CATEGORY_PRICE_RANGES[category] || null;
}
__name(getPriceRangeForCategory, "getPriceRangeForCategory");
var SAMPLE_KEYWORDS = ["\u5C0F\u6837", "\u8BD5\u7528\u88C5", "\u4E2D\u6837", "\u4F53\u9A8C\u88C5", "1ml", "2ml", "3ml", "5ml", "10ml", "0.5ml", "1.5ml", "30ml*3", "3\u652F\u88C5", "5\u652F\u88C5", "\u652F\u88C5", "\u5206\u88C5"];
function isSampleProduct(title) {
  return SAMPLE_KEYWORDS.some(function(s) {
    return title.indexOf(s) !== -1;
  });
}
__name(isSampleProduct, "isSampleProduct");
var _curatedCache = null;
async function loadCuratedProducts() {
  if (_curatedCache !== null) return _curatedCache;
  try {
    var resp = await fetch("/_curated-products.json");
    if (resp.ok) {
      var data = await resp.json();
      _curatedCache = data.products || [];
      console.log("[curated] Loaded " + _curatedCache.length + " products");
      return _curatedCache;
    }
  } catch (e) {
    console.warn("[curated] Failed to load:", e);
  }
  _curatedCache = [];
  return _curatedCache;
}
__name(loadCuratedProducts, "loadCuratedProducts");
async function findCuratedProduct(productName, env) {
  var name = productName.trim().toLowerCase();
  var products = await loadCuratedProducts();
  var semanticHints = {
    "primer": ["\u9694\u79BB", "\u5986\u524D\u4E73", "primer"],
    "foundation": ["\u7C89\u5E95", "foundation"],
    "moisturiz": ["\u4FDD\u6E7F", "\u9762\u971C", "\u7CBE\u534E", "moisturizer", "cream", "serum"],
    "serum": ["\u7CBE\u534E", "serum", "\u808C\u5E95\u6DB2"],
    "eyeshadow": ["\u773C\u5F71", "eyeshadow"],
    "mascara": ["\u776B\u6BDB\u818F", "mascara"],
    "eyeliner": ["\u773C\u7EBF", "eyeliner"],
    "brow": ["\u7709\u7B14", "\u7709\u6BDB", "brow"],
    "blush": ["\u816E\u7EA2", "blush"],
    "concealer": ["\u906E\u7455", "concealer"],
    "powder": ["\u6563\u7C89", "\u5B9A\u5986", "powder"],
    "lip": ["\u53E3\u7EA2", "\u5507\u91C9", "lip"],
    "sunscreen": ["\u9632\u6652", "sunscreen"],
    "cleanser": ["\u6D01\u9762", "cleanser"]
  };
  for (var i = 0; i < products.length; i++) {
    var cp = products[i];
    var tagMatch = cp.tags && cp.tags.some(function(t) {
      return name.includes(t.toLowerCase());
    });
    var kwMatch = cp.keywords && cp.keywords.some(function(k) {
      return name.includes(k.toLowerCase()) || k.toLowerCase().includes(name);
    });
    if (tagMatch || kwMatch) {
      console.log("[curated] Matched: " + cp.name + " for " + productName);
      return cp;
    }
    for (var hintKey of Object.keys(semanticHints)) {
      if (name.includes(hintKey)) {
        var hints = semanticHints[hintKey];
        var hintMatch = cp.tags && cp.tags.some(function(t) {
          return hints.some(function(h) {
            return t.toLowerCase() === h.toLowerCase();
          });
        });
        if (hintMatch) {
          console.log("[curated] Semantic Matched: " + cp.name + " for " + productName + " (hint=" + hintKey + ")");
          return cp;
        }
      }
    }
  }
  return null;
}
__name(findCuratedProduct, "findCuratedProduct");
async function findProductByKeyword(productName, env) {
  if (!productName || productName.trim().length < 2) return null;
  var name = productName.trim();
  var category = detectCategory(name);
  var priceRange = getPriceRangeForCategory(category);
  var fallbackSteps = priceRange ? [priceRange[0], Math.floor(priceRange[0] * 0.5), Math.floor(priceRange[0] * 0.2), 1] : [MIN_PRICE, Math.floor(MIN_PRICE * 0.5), 1];
  var maxPrice = priceRange ? priceRange[1] : MAX_PRICE;
  var products = await searchTaobaoProducts(name, env, 10);
  if (products.length === 0) {
    var brand = extractBrand(name);
    var catKeywords = BRAND_CATEGORY_MAP[brand] || [];
    var searchCandidates = [];
    if (category) {
      searchCandidates.push(brand ? brand + " " + category : category);
    }
    for (var ci = 0; ci < catKeywords.length; ci++) {
      searchCandidates.push(brand + " " + catKeywords[ci]);
    }
    searchCandidates.push(brand || name);
    for (var si = 0; si < searchCandidates.length; si++) {
      var kw = searchCandidates[si];
      products = await searchTaobaoProducts(kw, env, 10);
      if (products.length > 0) {
        console.log('[taobao] Fallback keyword: "' + kw + '" -> ' + products.length + " results");
        break;
      }
    }
  }
  if (products.length === 0) {
    console.log("[taobao] No search results for: " + name);
    return null;
  }
  var relevant = products.filter(function(p) {
    var brandKey = extractBrand(name);
    var firstToken = name.split(/[\s\/]+/)[0].toLowerCase();
    var isMatch = p.title.includes(name) || brandKey && p.title.toLowerCase().includes(brandKey) || p.title.toLowerCase().includes(firstToken);
    if (!isMatch) return false;
    if (isSampleProduct(p.title)) return false;
    return true;
  });
  if (relevant.length === 0) {
    relevant = products.filter(function(p) {
      var brandKey = extractBrand(name);
      if (brandKey && !p.title.toLowerCase().includes(brandKey)) return false;
      if (isSampleProduct(p.title)) return false;
      return true;
    });
  }
  if (relevant.length === 0) {
    console.log("[taobao] No relevant non-sample products for: " + name);
    return null;
  }
  for (var fi = 0; fi < fallbackSteps.length; fi++) {
    var floor = fallbackSteps[fi];
    var candidates = relevant.filter(function(p) {
      return p.price >= floor && p.price <= maxPrice;
    });
    if (candidates.length > 0) {
      candidates.sort(function(a, b) {
        return a.price - b.price;
      });
      var best = candidates[0];
      var tag = fi === 0 ? "exact" : "fallback floor=\xA5" + floor;
      console.log("[taobao] Selected (" + tag + "): " + best.title.substring(0, 40) + " (\xA5" + best.price + ")");
      return best;
    }
    if (fi < fallbackSteps.length - 1) {
      console.log("[taobao] No match at floor \xA5" + floor + ", trying next fallback...");
    }
  }
  console.log("[taobao] No valid match for: " + name + " (category=" + category + ")");
  return null;
}
__name(findProductByKeyword, "findProductByKeyword");
async function searchTaobaoProducts(keyword, env, limit = 10) {
  var appKey = env.TAOBAO_APP_KEY;
  var appSecret = env.TAOBAO_APP_SECRET;
  var pid = env.TAOBAO_PID || "";
  var adzoneMatch = pid.match(/_(\d+)$/);
  var adzoneId = adzoneMatch ? adzoneMatch[1] : "";
  if (!appKey || !appSecret) {
    console.warn("[taobao] TAOBAO_APP_KEY or TAOBAO_APP_SECRET not configured");
    return [];
  }
  var cacheKey = "tb:" + keyword.substring(0, 50);
  try {
    var cached = await env.SESSION_KV.get(cacheKey, "json");
    if (cached) {
      console.log("[taobao] Cache hit for " + keyword);
      return cached;
    }
  } catch (e) {
    console.warn("[taobao] Cache read error:", e);
  }
  try {
    var timestamp = String(Math.floor(Date.now() / 1e3));
    var params = {
      app_key: appKey,
      method: "taobao.tbk.dg.material.optional.upgrade",
      timestamp,
      v: "2.0",
      sign_method: "md5",
      q: keyword,
      page_no: "1",
      page_size: String(limit),
      fields: "num_iid,title,pict_url,small_images,resale_price,final_promotion_price,item_url,shop_title,seller_nick,coupon_info,click_url,short_title,brand_name,volume,user_type,zk_final_price"
    };
    if (adzoneId) params.adzone_id = adzoneId;
    var sign = await buildSign(appSecret, params);
    var url = new URL("https://eco.taobao.com/router/rest");
    Object.entries(params).forEach(function(e) {
      url.searchParams.set(e[0], e[1]);
    });
    url.searchParams.set("sign", sign);
    console.log("[taobao] Fetching " + keyword + " -> " + url.toString().slice(0, 120));
    var resp = await fetch(url.toString(), { headers: { "User-Agent": "BeautyApp/1.0" }, signal: AbortSignal.timeout(15e3) });
    if (!resp.ok) {
      console.error("[taobao] API HTTP error " + resp.status);
      return [];
    }
    var xmlText = await resp.text();
    var products = parseTaobaoXml(xmlText);
    if (products.length > 0) {
      try {
        await env.SESSION_KV.put(cacheKey, JSON.stringify(products), { expirationTtl: CACHE_TTL });
        console.log("[taobao] Cached " + products.length + " for " + keyword);
      } catch (e) {
        console.warn("[taobao] Cache write error:", e);
      }
    }
    return products;
  } catch (e) {
    console.error("[taobao] Search error for " + keyword + ":", e);
    return [];
  }
}
__name(searchTaobaoProducts, "searchTaobaoProducts");

// api/_utils.ts
var SESSION_PREFIX = "session:";
var SESSION_TTL = 7 * 24 * 60 * 60;
var ADMIN_SESSION_PREFIX = "admin_session:";
var ADMIN_SESSION_TTL = 30 * 24 * 60 * 60;
async function requireAdminAuth(req, env) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const sessionKey = `${ADMIN_SESSION_PREFIX}${token}`;
  const sessionStr = await env.SESSION_KV.get(sessionKey);
  if (!sessionStr) return false;
  const session = JSON.parse(sessionStr);
  const now = Math.floor(Date.now() / 1e3);
  if (session.expiresAt < now) return false;
  await env.SESSION_KV.put(sessionKey, sessionStr, {
    expirationTtl: ADMIN_SESSION_TTL
  });
  return true;
}
__name(requireAdminAuth, "requireAdminAuth");
function base64urlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const bytes = new Uint8Array(atob(base64).split("").map((c) => c.charCodeAt(0)));
  return bytes;
}
__name(base64urlDecode, "base64urlDecode");
async function verifyHmacSha256(key, message, signature) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify("HMAC", cryptoKey, signature, enc.encode(message));
}
__name(verifyHmacSha256, "verifyHmacSha256");
async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const valid = await verifyHmacSha256(secret, header + "." + body, base64urlDecode(signature));
  if (!valid) return null;
  try {
    const payload = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyJwt, "verifyJwt");
async function requireAuth(req, env) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  if (authHeader.startsWith("Bearer ") && env.AUTH_JWT_SECRET) {
    const jwtToken = authHeader.slice("Bearer ".length);
    const payload = await verifyJwt(jwtToken, env.AUTH_JWT_SECRET);
    if (payload) {
      return { userId: payload.user_id };
    }
  }
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const sessionKey = `${SESSION_PREFIX}${token}`;
  const sessionStr = await env.SESSION_KV.get(sessionKey);
  if (!sessionStr) return null;
  const session = JSON.parse(sessionStr);
  const now = Math.floor(Date.now() / 1e3);
  if (session.expiresAt < now) return null;
  await env.SESSION_KV.put(sessionKey, sessionStr, {
    expirationTtl: SESSION_TTL
  });
  return { userId: session.userId };
}
__name(requireAuth, "requireAuth");
function beijingDate() {
  const now = /* @__PURE__ */ new Date();
  const shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1e3);
  return shanghai.toISOString().slice(0, 10);
}
__name(beijingDate, "beijingDate");
function generateId() {
  return crypto.randomUUID();
}
__name(generateId, "generateId");
function getAdminCredentials(env) {
  const username = env.ADMIN_USERNAME;
  const password = env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}
__name(getAdminCredentials, "getAdminCredentials");
async function verifyAdminCredentials(username, password, env) {
  const creds = getAdminCredentials(env);
  if (!creds) return false;
  return creds.username === username && creds.password === password;
}
__name(verifyAdminCredentials, "verifyAdminCredentials");
function parseDeepseekJson(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^```(?:json)?`/m, "").replace(/```\s*$/m, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("[parseDeepseekJson] Invalid JSON after stripping markdown wrapper:", cleaned.slice(0, 500));
    return null;
  }
}
__name(parseDeepseekJson, "parseDeepseekJson");
async function enrichProductRecs(report, env) {
  const productRecs = report.productRecs ?? {};
  const dims = Object.keys(productRecs);
  for (const dim of dims) {
    const items = productRecs[dim];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const name = item.name;
      if (!name || typeof name !== "string") continue;
      try {
        const product = await findProductByKeyword(name, env);
        if (product) {
          item.imageUrl = product.imageUrl;
          item.price = product.price;
          item.itemUrl = product.itemUrl;
          item.shopTitle = product.shopTitle;
          item.brandName = product.brandName;
          console.log("[tier2/enrich] Found: " + name + " -> " + product.title.slice(0, 40));
        } else {
          console.log("[tier2/enrich] No match for: " + name);
        }
        const curated = await findCuratedProduct(name, env);
        if (curated) {
          item.curatedProduct = {
            name: curated.name,
            price: curated.price,
            imageUrl: curated.imageUrl,
            itemUrl: curated.itemUrl,
            shopTitle: curated.shopTitle
          };
          console.log("[tier2/enrich] Curated 2nd product: " + curated.name);
        }
      } catch (e) {
        console.warn("[tier2/enrich] Error enriching " + name + ":", e);
      }
    }
  }
}
__name(enrichProductRecs, "enrichProductRecs");
async function callDeepSeekTier2(tier1Report, env, loggerPrefix = "[tier2/generate]") {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn(loggerPrefix + " DEEPSEEK_API_KEY not configured");
    return null;
  }
  const prompt = `You are a professional beauty consultant. Based on the following face analysis report, provide detailed personalized recommendations for each of the 6 makeup steps.

Face Analysis Report:
${JSON.stringify(tier1Report, null, 2)}

Rules for each step:
- Step 01 (base makeup): based on skinType (skin condition)
- Step 02 (eyebrows): based on eyebrowShape
- Step 03 (eye makeup): combine eyeShape + threeFiveRatio
- Step 04 (blush): based on symmetry
- Step 05 (contour): based on faceShape
- Step 06 (lip): combine personaTags + highlight to infer skin tone & lip shape recommendations

Output strict JSON only (no markdown wrapping):
{
  "coreConclusion": "1-2 sentence overall style conclusion in Chinese",
  "style": "style tag like \u6E29\u67D4\u77E5\u6027\u98CE",
  "steps": [
    {"step":"01","label":"\u5E95\u5986","key":"skinType","emoji":"\u{1F9F4}","analysis":"<personalized analysis for THIS user>","why":"<why this approach fits>","steps":"<step-by-step instructions separated by arrows>","tips":"<warnings separated by semicolons>","products":[{"name":"product name","desc":"reason","price":"price"}]},
    {"step":"02","label":"\u7709\u5F62","key":"eyebrowShape","emoji":"\u270F\uFE0F","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]},
    {"step":"03","label":"\u773C\u5986","key":"eyeShape","emoji":"\u{1F441}","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]},
    {"step":"04","label":"\u816E\u7EA2","key":"symmetry","emoji":"\u{1F338}","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]},
    {"step":"05","label":"\u4FEE\u5BB9","key":"faceShape","emoji":"\u{1FA9E}","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]},
    {"step":"06","label":"\u5507\u5986","key":"lip","emoji":"\u{1F484}","analysis":"...","why":"...","steps":"...","tips":"...","products":[{"name":"...","desc":"...","price":"..."}]}
  ],
  "overallTips": "1-2 sentence summary in Chinese",
  "productRecs": {
    "skinType": [{"name":"product name","desc":"reason"}],
    "eyebrowShape": [{"name":"product name","desc":"reason"}],
    "eyeShape": [{"name":"product name","desc":"reason"}],
    "symmetry": [{"name":"product name","desc":"reason"}],
    "faceShape": [{"name":"product name","desc":"reason"}],
    "lip": [{"name":"product name","desc":"reason"}]
  }
}

Important:
1. Every step must be personalized to THIS specific user - reference their actual features
2. Use '\u4F60\u662FX' format in analysis (e.g. '\u4F60\u662F\u5706\u8138' not '\u5706\u8138\u9002\u5408')
3. Separate tips with Chinese semicolons (;)
4. Recommend specific real products suitable for this user`;
  async function doCall(retryCount) {
    try {
      const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], max_tokens: 8e3, temperature: 0.3 }),
        signal: AbortSignal.timeout(9e4)
      });
      if (!resp.ok) {
        const eb = await resp.text().catch(() => "");
        console.error(loggerPrefix + " DeepSeek error " + resp.status + ": " + eb.slice(0, 200));
        return null;
      }
      const data = await resp.json();
      const raw = data?.choices?.[0]?.message?.content;
      if (!raw) return null;
      const report = parseDeepseekJson(raw);
      if (report) {
        await enrichProductRecs(report, env);
      }
      return report;
    } catch (e) {
      console.error(loggerPrefix + " DeepSeek exception:", e);
      return null;
    }
  }
  __name(doCall, "doCall");
  return doCall(0);
}
__name(callDeepSeekTier2, "callDeepSeekTier2");

// api/admin/influencers/[id]/approve.ts
var POST = /* @__PURE__ */ __name(async (context) => {
  const { request, env, params } = context;
  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "\u65E0\u6743\u9650" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11\u8FBE\u4EBAID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const existing = await env.DB.prepare(
    "SELECT id, status FROM influencers WHERE id = ? LIMIT 1"
  ).bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: "\u8FBE\u4EBA\u4E0D\u5B58\u5728" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `UPDATE influencers SET status = 'approved', updated_at = ? WHERE id = ?`
  ).bind(now, id).run();
  return new Response(JSON.stringify({ success: true, id, status: "approved" }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost = /* @__PURE__ */ __name(async (...args) => {
  return POST(...args);
}, "onRequestPost");

// api/admin/influencers/[id]/reject.ts
var POST2 = /* @__PURE__ */ __name(async (context) => {
  const { request, env, params } = context;
  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "\u65E0\u6743\u9650" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  const id = params.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11\u8FBE\u4EBAID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const existing = await env.DB.prepare(
    "SELECT id, status FROM influencers WHERE id = ? LIMIT 1"
  ).bind(id).first();
  if (!existing) {
    return new Response(JSON.stringify({ error: "\u8FBE\u4EBA\u4E0D\u5B58\u5728" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  let rejectReason = null;
  try {
    const body = await request.json();
    rejectReason = body?.reason ?? null;
  } catch {
  }
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `UPDATE influencers SET status = 'rejected', reject_reason = ?, updated_at = ? WHERE id = ?`
  ).bind(rejectReason, now, id).run();
  return new Response(JSON.stringify({ success: true, id, status: "rejected" }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost2 = /* @__PURE__ */ __name(async (...args) => {
  return POST2(...args);
}, "onRequestPost");

// api/auth/phone/login.ts
var POST3 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { phone, code } = body;
  const stored = await env.SESSION_KV.get("sms_code:" + phone);
  if (!stored) {
    return new Response(JSON.stringify({ error: "\u9A8C\u8BC1\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u83B7\u53D6" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const { code: expectedCode, expiresAt } = JSON.parse(stored);
  const now = Math.floor(Date.now() / 1e3);
  if (expiresAt < now) {
    return new Response(JSON.stringify({ error: "\u9A8C\u8BC1\u7801\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u83B7\u53D6" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (expectedCode !== code) {
    return new Response(JSON.stringify({ error: "\u9A8C\u8BC1\u7801\u9519\u8BEF" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const nowMs = Date.now();
  const existing = await env.DB.prepare(
    "SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1"
  ).bind(phone).first();
  const userId = existing?.id ?? generateId();
  if (!existing) {
    await env.DB.prepare(
      "INSERT INTO users (id, phone, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ).bind(userId, phone, nowMs, nowMs).run();
  } else {
    await env.DB.prepare(
      "UPDATE users SET updated_at = ? WHERE id = ?"
    ).bind(nowMs, userId).run();
  }
  const sessionId = generateId();
  await env.SESSION_KV.put(
    "session:" + sessionId,
    JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60 }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );
  await env.SESSION_KV.delete("sms_code:" + phone);
  const hasPassword = !!existing?.password_hash;
  return new Response(JSON.stringify({ sessionId, hasPassword }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost3 = /* @__PURE__ */ __name(async (...args) => {
  return POST3(...args);
}, "onRequestPost");

// api/auth/phone/login-password.ts
var POST4 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { phone, password } = body;
  const user = await env.DB.prepare(
    "SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1"
  ).bind(phone).first();
  if (!user) {
    return new Response(JSON.stringify({ error: "\u624B\u673A\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!user.password_hash) {
    return new Response(JSON.stringify({ error: "\u8BE5\u8D26\u53F7\u5C1A\u672A\u8BBE\u7F6E\u5BC6\u7801\uFF0C\u8BF7\u4F7F\u7528\u9A8C\u8BC1\u7801\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const [storedHash, salt] = user.password_hash.split(":");
  if (!storedHash || !salt) {
    return new Response(JSON.stringify({ error: "\u624B\u673A\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashBuf = new Uint8Array(derivedBits);
  const inputHash = btoa(String.fromCharCode(...hashBuf));
  if (inputHash !== storedHash) {
    return new Response(JSON.stringify({ error: "\u624B\u673A\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userId = user.id;
  const now = Math.floor(Date.now() / 1e3);
  const sessionId = generateId();
  await env.SESSION_KV.put(
    "session:" + sessionId,
    JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60 }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );
  return new Response(JSON.stringify({ sessionId }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost4 = /* @__PURE__ */ __name(async (...args) => {
  return POST4(...args);
}, "onRequestPost");

// api/auth/phone/send-code.ts
var POST5 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { phone } = body;
  const code = String(Math.floor(1e5 + Math.random() * 9e5));
  await env.SESSION_KV.put(
    `sms_code:${phone}`,
    JSON.stringify({ code, expiresAt: Math.floor(Date.now() / 1e3) + 300 }),
    { expirationTtl: 300 }
  );
  console.log(`[SMS Code] ${phone} -> ${code}`);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost5 = /* @__PURE__ */ __name(async (...args) => {
  return POST5(...args);
}, "onRequestPost");

// api/auth/wechat/login.ts
var POST6 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { code } = body;
  return new Response(
    JSON.stringify({
      sessionId: generateId(),
      needPhoneBind: false
      // conflictWithPhone: "138****1234", // 冲突时的提示
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
var onRequestPost6 = /* @__PURE__ */ __name(async (...args) => {
  return POST6(...args);
}, "onRequestPost");

// api/orders/callback/alipay.ts
var POST7 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.text();
  return new Response("success");
}, "POST");
var onRequestPost7 = /* @__PURE__ */ __name(async (...args) => {
  return POST7(...args);
}, "onRequestPost");

// api/orders/callback/wechat.ts
var POST8 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.text();
  return new Response("success", { headers: { "Content-Type": "text/xml" } });
}, "POST");
var onRequestPost8 = /* @__PURE__ */ __name(async (...args) => {
  return POST8(...args);
}, "onRequestPost");

// api/admin/config.ts
var GET = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER
    )
  `).run();
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('influencer_apply_message', '\u7533\u8BF7\u5DF2\u63D0\u4EA4\uFF0C\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u8054\u7CFB\u4F60\uFF5E', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('influencer_contact_info', '', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('sms_login_enabled', 'false', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('tier2_show_ai_image', 'true', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('tier2_btn_color', '#E91E63', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('tier2_hook_text', '\u89E3\u9501\u4E13\u5C5E\u62A5\u544A\uFF0C\u642D\u914D\u66F4\u591A\u573A\u666F', ?)`
  ).bind(now).run();
  const rows = await env.DB.prepare(
    "SELECT key, value, updated_at FROM app_config ORDER BY key"
  ).all();
  return new Response(JSON.stringify({ configs: rows.results ?? [] }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var POST9 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "\u65E0\u6743\u9650" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { key, value } = body;
  if (!key || value === void 0) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 key \u6216 value" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(key, value, now).run();
  return new Response(JSON.stringify({ success: true, key, value }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestGet = /* @__PURE__ */ __name(async (...args) => {
  return GET(...args);
}, "onRequestGet");
var onRequestPost9 = /* @__PURE__ */ __name(async (...args) => {
  return POST9(...args);
}, "onRequestPost");

// api/admin/influencers.ts
function fixMakeupPhotoUrl(url, influencerId) {
  if (!url) return null;
  if (url.includes("${makeupKey}") || url.includes("${makeup_key}")) {
    const key = `influencer/${influencerId}/makeup.jpg`;
    return `/api/r2-proxy?key=${encodeURIComponent(key)}&bucket=perm`;
  }
  if (url.startsWith("/api/r2-perm/")) {
    const key = url.slice("/api/r2-perm/".length);
    return `/api/r2-proxy?key=${encodeURIComponent(key)}&bucket=perm`;
  }
  return url;
}
__name(fixMakeupPhotoUrl, "fixMakeupPhotoUrl");
var GET2 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "\u65E0\u6743\u9650" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  let sql = `SELECT i.id, i.user_id, i.nickname, i.bio, i.makeup_photo_url,
                  i.platform, i.link1, i.link2, i.status, i.reject_reason,
                  i.created_at, i.updated_at, i.styles, fp.tags
            FROM influencers i
            LEFT JOIN influencer_face_profile fp ON fp.influencer_id = i.id`;
  const params = [];
  if (status) {
    sql += " WHERE status = ?";
    params.push(status);
  }
  sql += " ORDER BY created_at DESC";
  const results = await env.DB.prepare(sql).bind(...params).all();
  const list = (results.results ?? []).map((item) => {
    let personaTags = [];
    try {
      personaTags = JSON.parse(item.tags || "{}").personaTags ? [JSON.parse(item.tags || "{}").personaTags] : [];
    } catch {
    }
    return {
      ...item,
      makeup_photo_url: fixMakeupPhotoUrl(item.makeup_photo_url, item.id),
      persona_tags: personaTags,
      styles: (() => {
        try {
          return JSON.parse(item.styles || "[]");
        } catch {
          return [];
        }
      })()
    };
  });
  return new Response(JSON.stringify({ list }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var onRequestGet2 = /* @__PURE__ */ __name(async (...args) => {
  return GET2(...args);
}, "onRequestGet");

// api/admin/login.ts
var POST10 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { username, password } = body;
  const ok = await verifyAdminCredentials(username, password, env);
  if (!ok) {
    return new Response(JSON.stringify({ error: "\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const sessionId = generateId();
  const now = Math.floor(Date.now() / 1e3);
  await env.SESSION_KV.put(
    "admin_session:" + sessionId,
    JSON.stringify({ expiresAt: now + 30 * 24 * 60 * 60 }),
    { expirationTtl: 30 * 24 * 60 * 60 }
  );
  return new Response(JSON.stringify({ sessionId }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost10 = /* @__PURE__ */ __name(async (...args) => {
  return POST10(...args);
}, "onRequestPost");

// api/admin/questionnaire-options.ts
var GET3 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "\u65E0\u6743\u9650" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS questionnaire_options (
      dimension TEXT PRIMARY KEY,
      options TEXT NOT NULL,
      updated_at INTEGER
    )
  `).run();
  const rows = await env.DB.prepare(
    "SELECT dimension, options, updated_at FROM questionnaire_options ORDER BY dimension"
  ).all();
  const options = (rows.results ?? []).map((row) => ({
    dimension: row.dimension,
    options: (() => {
      try {
        return JSON.parse(row.options);
      } catch {
        return [];
      }
    })(),
    updated_at: row.updated_at
  }));
  return new Response(JSON.stringify({ options }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var POST11 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const isAdmin = await requireAdminAuth(request, env);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "\u65E0\u6743\u9650" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { dimension, options } = body;
  if (!dimension || !Array.isArray(options)) {
    return new Response(
      JSON.stringify({ error: "\u7F3A\u5C11 dimension \u6216 options \u5B57\u6BB5" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const optionsJson = JSON.stringify(options);
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `INSERT INTO questionnaire_options (dimension, options, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(dimension) DO UPDATE SET options = excluded.options, updated_at = excluded.updated_at`
  ).bind(dimension, optionsJson, now).run();
  return new Response(
    JSON.stringify({ success: true, dimension, options: optionsJson }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
var onRequestGet3 = GET3;
var onRequestPost11 = POST11;

// api/auth/auto-login.ts
var GET4 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const account = url.searchParams.get("account");
  if (!account || typeof account !== "string") {
    return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u8D26\u53F7" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const isEmail = account.includes("@");
  if (isEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u6B63\u786E\u7684\u90AE\u7BB1\u5730\u5740" }), { status: 400, headers: { "Content-Type": "application/json" } });
  } else {
    if (!/^1[3-9]\d{9}$/.test(account)) return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u6B63\u786E\u7684\u624B\u673A\u53F7" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const nowMs = Date.now();
  const now = Math.floor(Date.now() / 1e3);
  const user = isEmail ? await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ? LIMIT 1").bind(account).first() : await env.DB.prepare("SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1").bind(account).first();
  let userId;
  let isNew;
  let needPassword = false;
  if (!user) {
    userId = generateId();
    const phone = isEmail ? "gen_" + userId : account;
    const email = isEmail ? account : null;
    await env.DB.prepare("INSERT INTO users (id, phone, email, created_at, updated_at, password_hash) VALUES (?, ?, ?, ?, ?, NULL)").bind(userId, phone, email, nowMs, nowMs).run();
    isNew = true;
  } else {
    userId = user.id;
    isNew = false;
    needPassword = !!user.password_hash;
  }
  if (!isNew && user?.password_hash) {
    const providedPassword = url.searchParams.get("password");
    if (!providedPassword) {
      return new Response(JSON.stringify({ needPassword: true, isNew: false, message: "\u8BF7\u8F93\u5165\u5BC6\u7801" }), {
        headers: { "Content-Type": "application/json" }
      });
    }
    const [storedHash, salt] = user.password_hash.split(":");
    if (!storedHash || !salt) {
      return new Response(JSON.stringify({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(providedPassword), "PBKDF2", false, ["deriveBits"]);
    const derivedBits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" }, keyMaterial, 256);
    const hashBuf = new Uint8Array(derivedBits);
    const inputHash = btoa(String.fromCharCode(...hashBuf));
    if (inputHash !== storedHash) {
      return new Response(JSON.stringify({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF", needPassword: true, isNew: false }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  const sessionId = generateId();
  await env.SESSION_KV.put("session:" + sessionId, JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60 }), { expirationTtl: 7 * 24 * 60 * 60 });
  return new Response(JSON.stringify({ sessionId, isNew, needPassword }), { headers: { "Content-Type": "application/json" } });
}, "GET");
var onRequestGet4 = /* @__PURE__ */ __name(async (...args) => GET4(args[0]), "onRequestGet");

// api/auth/login.ts
var POST12 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { account, password } = body;
  if (!account || typeof account !== "string" || !password) {
    return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u8D26\u53F7\u548C\u5BC6\u7801" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const user = await env.DB.prepare(
    "SELECT id, password_hash FROM users WHERE phone = ? OR email = ? LIMIT 1"
  ).bind(account, account).first();
  if (!user) {
    return new Response(JSON.stringify({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!user.password_hash) {
    return new Response(JSON.stringify({ error: "\u8BE5\u8D26\u53F7\u5C1A\u672A\u8BBE\u7F6E\u5BC6\u7801" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const [storedHash, salt] = user.password_hash.split(":");
  if (!storedHash || !salt) {
    return new Response(JSON.stringify({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashBuf = new Uint8Array(derivedBits);
  const inputHash = btoa(String.fromCharCode(...hashBuf));
  if (inputHash !== storedHash) {
    return new Response(JSON.stringify({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userId = user.id;
  const now = Math.floor(Date.now() / 1e3);
  const sessionId = generateId();
  await env.SESSION_KV.put(
    "session:" + sessionId,
    JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60 }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );
  return new Response(JSON.stringify({ sessionId }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost12 = /* @__PURE__ */ __name(async (...args) => {
  return POST12(...args);
}, "onRequestPost");

// api/auth/login-or-register.ts
var POST13 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { account, password, confirmPassword } = body;
  if (!account || typeof account !== "string") {
    return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u8D26\u53F7" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const isEmail = account.includes("@");
  if (isEmail) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(account)) {
      return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u6B63\u786E\u7684\u90AE\u7BB1\u5730\u5740" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  } else {
    const phoneRe = /^1[3-9]\d{9}$/;
    if (!phoneRe.test(account)) {
      return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u6B63\u786E\u7684\u624B\u673A\u53F7" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return new Response(JSON.stringify({ error: "\u5BC6\u7801\u957F\u5EA6\u81F3\u5C116\u4F4D" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return new Response(JSON.stringify({ error: "\u5BC6\u7801\u9700\u540C\u65F6\u5305\u542B\u5B57\u6BCD\u548C\u6570\u5B57" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (password !== confirmPassword) {
    return new Response(JSON.stringify({ error: "\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const nowMs = Date.now();
  const user = isEmail ? await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ? LIMIT 1").bind(account).first() : await env.DB.prepare("SELECT id, password_hash FROM users WHERE phone = ? LIMIT 1").bind(account).first();
  if (!user) {
    const salt2 = generateId();
    const enc2 = new TextEncoder();
    const keyMaterial2 = await crypto.subtle.importKey(
      "raw",
      enc2.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits2 = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: enc2.encode(salt2), iterations: 1e5, hash: "SHA-256" },
      keyMaterial2,
      256
    );
    const hashBuf2 = new Uint8Array(derivedBits2);
    const passwordHash = btoa(String.fromCharCode(...hashBuf2)) + ":" + salt2;
    const userId2 = generateId();
    const phone = isEmail ? "gen_" + userId2 : account;
    const email = isEmail ? account : null;
    await env.DB.prepare(
      "INSERT INTO users (id, phone, email, created_at, updated_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId2, phone, email, nowMs, nowMs, passwordHash).run();
    const now2 = Math.floor(Date.now() / 1e3);
    const sessionId2 = generateId();
    await env.SESSION_KV.put(
      "session:" + sessionId2,
      JSON.stringify({ userId: userId2, expiresAt: now2 + 7 * 24 * 60 * 60 }),
      { expirationTtl: 7 * 24 * 60 * 60 }
    );
    return new Response(JSON.stringify({ sessionId: sessionId2, isNew: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!user.password_hash) {
    return new Response(JSON.stringify({ error: "\u8BE5\u8D26\u53F7\u5C1A\u672A\u8BBE\u7F6E\u5BC6\u7801\uFF0C\u8BF7\u4F7F\u7528\u9A8C\u8BC1\u7801\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const [storedHash, salt] = user.password_hash.split(":");
  if (!storedHash || !salt) {
    return new Response(JSON.stringify({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashBuf = new Uint8Array(derivedBits);
  const inputHash = btoa(String.fromCharCode(...hashBuf));
  if (inputHash !== storedHash) {
    return new Response(JSON.stringify({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userId = user.id;
  const now = Math.floor(Date.now() / 1e3);
  const sessionId = generateId();
  await env.SESSION_KV.put(
    "session:" + sessionId,
    JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60 }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );
  return new Response(JSON.stringify({ sessionId, isNew: false }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost13 = /* @__PURE__ */ __name(async (...args) => {
  return POST13(...args);
}, "onRequestPost");

// api/auth/logout.ts
var POST14 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  await env.SESSION_KV.delete(`session:${token}`);
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost14 = /* @__PURE__ */ __name(async (...args) => {
  return POST14(...args);
}, "onRequestPost");

// api/auth/register.ts
var POST15 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { account, password, confirmPassword } = body;
  if (!account || typeof account !== "string") {
    return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u8D26\u53F7" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const isEmail = account.includes("@");
  if (isEmail) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(account)) {
      return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u6B63\u786E\u7684\u90AE\u7BB1\u5730\u5740" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  } else {
    const phoneRe = /^1[3-9]\d{9}$/;
    if (!phoneRe.test(account)) {
      return new Response(JSON.stringify({ error: "\u8BF7\u8F93\u5165\u6B63\u786E\u7684\u624B\u673A\u53F7" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return new Response(JSON.stringify({ error: "\u5BC6\u7801\u957F\u5EA6\u81F3\u5C116\u4F4D" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return new Response(JSON.stringify({ error: "\u5BC6\u7801\u9700\u540C\u65F6\u5305\u542B\u5B57\u6BCD\u548C\u6570\u5B57" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (password !== confirmPassword) {
    return new Response(JSON.stringify({ error: "\u4E24\u6B21\u8F93\u5165\u7684\u5BC6\u7801\u4E0D\u4E00\u81F4" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const nowMs = Date.now();
  if (isEmail) {
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ? LIMIT 1"
    ).bind(account).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "\u8BE5\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  } else {
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE phone = ? LIMIT 1"
    ).bind(account).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "\u8BE5\u624B\u673A\u53F7\u5DF2\u88AB\u6CE8\u518C" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
  const salt = generateId();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashBuf = new Uint8Array(derivedBits);
  const passwordHash = btoa(String.fromCharCode(...hashBuf)) + ":" + salt;
  const userId = generateId();
  const phone = isEmail ? "gen_" + userId : account;
  const email = isEmail ? account : null;
  await env.DB.prepare(
    "INSERT INTO users (id, phone, email, created_at, updated_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(userId, phone, email, nowMs, nowMs, passwordHash).run();
  const now = Math.floor(Date.now() / 1e3);
  const sessionId = generateId();
  await env.SESSION_KV.put(
    "session:" + sessionId,
    JSON.stringify({ userId, expiresAt: now + 7 * 24 * 60 * 60 }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );
  return new Response(JSON.stringify({ sessionId }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost15 = /* @__PURE__ */ __name(async (...args) => {
  return POST15(...args);
}, "onRequestPost");

// api/auth/set-password.ts
var POST16 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const auth = await requireAuth(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: "\u8BF7\u5148\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { password } = body;
  if (!password || typeof password !== "string" || password.length < 6) {
    return new Response(JSON.stringify({ error: "\u5BC6\u7801\u957F\u5EA6\u81F3\u5C116\u4F4D" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return new Response(JSON.stringify({ error: "\u5BC6\u7801\u9700\u540C\u65F6\u5305\u542B\u5B57\u6BCD\u548C\u6570\u5B57" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const salt = generateId();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 1e5, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashBuf = new Uint8Array(derivedBits);
  const passwordHash = btoa(String.fromCharCode(...hashBuf)) + ":" + salt;
  await env.DB.prepare(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?"
  ).bind(passwordHash, Date.now(), auth.userId).run();
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost16 = /* @__PURE__ */ __name(async (...args) => {
  return POST16(...args);
}, "onRequestPost");

// api/debug/crypto-test.ts
var GET5 = /* @__PURE__ */ __name(async (context) => {
  const enc = new TextEncoder();
  const result = {};
  try {
    const key = await crypto.subtle.importKey("raw", enc.encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode("hello"));
    const valid = await crypto.subtle.verify("HMAC", key, sig, enc.encode("hello"));
    result.test1 = { signed: true, verified: valid, sigLen: new Uint8Array(sig).length };
  } catch (e) {
    result.test1 = { error: String(e) };
  }
  try {
    const k1 = await crypto.subtle.importKey("raw", enc.encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", k1, enc.encode("hello"));
    const k2 = await crypto.subtle.importKey("raw", enc.encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", k2, sig, enc.encode("hello"));
    result.test2 = { verified: valid, sigBytes: new Uint8Array(sig).length };
  } catch (e) {
    result.test2 = { error: String(e) };
  }
  try {
    const key = await crypto.subtle.importKey("raw", enc.encode("test-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const knownSig = new Uint8Array([176, 52, 76, 103, 212, 191, 248, 208, 105, 140, 8, 187, 91, 99, 233, 206, 65, 109, 147, 39, 151, 94, 130, 218, 110, 146, 168, 127, 173, 82, 220, 29]);
    const valid = await crypto.subtle.verify("HMAC", key, knownSig, enc.encode("hello"));
    result.test3 = { verified: valid };
  } catch (e) {
    result.test3 = { error: String(e) };
  }
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
}, "GET");
var onRequestGet5 = /* @__PURE__ */ __name(async (...args) => GET5(...args), "onRequestGet");

// api/debug/env-dump.ts
var GET6 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const keys = Object.keys(env);
  const result = {};
  for (const k of keys) {
    const v = env[k];
    result[k] = typeof v === "string" ? v.length > 4 ? v.slice(0, 4) + "..." + v.length : v : String(typeof v);
  }
  return new Response(JSON.stringify(result, null, 2), { headers: { "Content-Type": "application/json" } });
}, "GET");
var onRequestGet6 = /* @__PURE__ */ __name(async (...args) => GET6(...args), "onRequestGet");

// api/debug/jwt-selftest.ts
function b64urlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return new Uint8Array(atob(base64).split("").map((c) => c.charCodeAt(0)));
}
__name(b64urlDecode, "b64urlDecode");
var POST17 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  const { token } = await request.json();
  const secret = env.AUTH_JWT_SECRET;
  const enc = new TextEncoder();
  if (!token) return new Response(JSON.stringify({ error: "no token" }), { status: 400 });
  if (!secret) return new Response(JSON.stringify({ error: "no secret" }), { status: 500 });
  const parts = token.split(".");
  if (parts.length !== 3) return new Response(JSON.stringify({ error: "not 3 parts" }), { status: 400 });
  const sigBytes = b64urlDecode(parts[2]);
  const message = parts[0] + "." + parts[1];
  const vkey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", vkey, sigBytes, enc.encode(message));
  const testReq = new Request(request.url, { headers: { Authorization: "Bearer " + token } });
  const authUser = await requireAuth(testReq, env);
  return new Response(JSON.stringify({ verifyResult: valid, authResult: authUser }), { headers: { "Content-Type": "application/json" } });
}, "POST");
var onRequestPost17 = /* @__PURE__ */ __name(async (...args) => POST17(...args), "onRequestPost");

// api/debug/jwt-test.ts
function b64urlDecode2(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return new Uint8Array(atob(base64).split("").map((c) => c.charCodeAt(0)));
}
__name(b64urlDecode2, "b64urlDecode");
var GET7 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  if (!env.DEBUG_MODE) {
    return new Response(JSON.stringify({ error: "not available in production" }), { status: 404 });
  }
  const secret = env.AUTH_JWT_SECRET;
  const enc = new TextEncoder();
  let sigResult = "N/A";
  let verifyResult = "N/A";
  let tokenPayload = "N/A";
  if (secret) {
    try {
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const now = Math.floor(Date.now() / 1e3);
      const payload = btoa(JSON.stringify({ user_id: "debug-test", iat: now, exp: now + 3600 })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const message = header + "." + payload;
      const skey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
      const sig = await crypto.subtle.sign("HMAC", skey, enc.encode(message));
      const sig64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const token = message + "." + sig64;
      const vkey = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
      const parts = token.split(".");
      const valid = await crypto.subtle.verify("HMAC", vkey, b64urlDecode2(parts[2]), enc.encode(parts[0] + "." + parts[1]));
      sigResult = "signed OK";
      verifyResult = String(valid);
      tokenPayload = payload;
    } catch (e) {
      sigResult = "ERROR: " + e.message;
    }
  } else {
    sigResult = "NO_SECRET";
  }
  return new Response(JSON.stringify({
    hasJwtSecret: !!secret,
    sigResult,
    verifyResult,
    tokenPayload
  }), { headers: { "Content-Type": "application/json" } });
}, "GET");
var onRequestGet7 = /* @__PURE__ */ __name(async (...args) => GET7(...args), "onRequestGet");

// api/debug/jwt-verify-test.ts
function b64urlDecode3(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return new Uint8Array(atob(base64).split("").map((c) => c.charCodeAt(0)));
}
__name(b64urlDecode3, "b64urlDecode");
var POST18 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  const { token } = await request.json();
  if (!token) return new Response(JSON.stringify({ error: "no token" }), { status: 400 });
  const secret = env.AUTH_JWT_SECRET;
  const parts = token.split(".");
  if (parts.length !== 3) return new Response(JSON.stringify({ error: "not 3 parts" }), { status: 400 });
  const [header, body, signature] = parts;
  const enc = new TextEncoder();
  const sigBytes = b64urlDecode3(signature);
  const message = header + "." + body;
  let r1 = "skip";
  let r2 = "skip";
  let r3 = "skip";
  if (secret) {
    try {
      const k1 = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
      r1 = await crypto.subtle.verify("HMAC", k1, sigBytes, enc.encode(message)) ? "true" : "false";
    } catch (e) {
      r1 = "err:" + e.message;
    }
    try {
      const k2 = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
      r2 = await crypto.subtle.verify("HMAC", k2, sigBytes, enc.encode(message)) ? "true" : "false";
    } catch (e) {
      r2 = "err:" + e.message;
    }
    try {
      const k3 = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const freshSig = await crypto.subtle.sign("HMAC", k3, enc.encode(message));
      r3 = await crypto.subtle.verify("HMAC", k3, freshSig, enc.encode(message)) ? "true" : "false";
    } catch (e) {
      r3 = "err:" + e.message;
    }
  }
  return new Response(JSON.stringify({
    hasSecret: !!secret,
    secretLen: secret?.length ?? 0,
    sigBytesLen: sigBytes.length,
    messageLen: message.length,
    r1,
    r2,
    r3
  }), { headers: { "Content-Type": "application/json" } });
}, "POST");
var onRequestPost18 = /* @__PURE__ */ __name(async (...args) => POST18(...args), "onRequestPost");

// api/debug/sms-code.ts
var GET8 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  if (!env.DEBUG_MODE) {
    return new Response(JSON.stringify({ error: "not available in production" }), { status: 404 });
  }
  const url = new URL(request.url);
  const phone = url.searchParams.get("phone");
  if (!phone) return new Response(JSON.stringify({ error: "missing phone" }), { status: 400 });
  const key = "sms_code:" + phone;
  const stored = await env.SESSION_KV.get(key);
  if (!stored) return new Response(JSON.stringify({ error: "code not found or expired" }), { status: 404 });
  const { code } = JSON.parse(stored);
  return new Response(JSON.stringify({ key, code }));
}, "GET");
var onRequestGet8 = /* @__PURE__ */ __name(async (...args) => {
  return GET8(...args);
}, "onRequestGet");

// api/debug/taobao-test.ts
var GET9 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), { status: 401 });
  const url = new URL(request.url);
  const keyword = url.searchParams.get("q") || "NARS \u4FEE\u5BB9\u7C89";
  const result = {
    keyword,
    hasAppKey: !!env.TAOBAO_APP_KEY,
    hasAppSecret: !!env.TAOBAO_APP_SECRET,
    hasPid: !!env.TAOBAO_PID,
    appKeyPrefix: env.TAOBAO_APP_KEY ? env.TAOBAO_APP_KEY.substring(0, 4) + "..." : "MISSING",
    pid: env.TAOBAO_PID || "MISSING"
  };
  try {
    const product = await findProductByKeyword(keyword, env);
    result.found = !!product;
    if (product) {
      result.product = {
        title: product.title,
        price: product.price,
        hasImage: !!(product.imageUrl && product.imageUrl.length > 10),
        hasLink: !!(product.itemUrl && product.itemUrl.length > 10),
        imageUrl: product.imageUrl ? product.imageUrl.substring(0, 80) : "MISSING",
        itemUrl: product.itemUrl ? product.itemUrl.substring(0, 80) : "MISSING"
      };
    }
  } catch (e) {
    result.error = String(e);
  }
  return new Response(JSON.stringify(result, null, 2), { headers: { "Content-Type": "application/json" } });
}, "GET");
var onRequestGet9 = /* @__PURE__ */ __name(async (...args) => {
  return GET9(...args);
}, "onRequestGet");

// api/influencers/apply.ts
var POST19 = /* @__PURE__ */ __name(async (context) => {
  const { request, env, waitUntil } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const formData = await request.formData();
  const nickname = formData.get("nickname");
  const bio = formData.get("bio");
  const makeupPhoto = formData.get("makeup_photo");
  const barePhoto = formData.get("bare_photo");
  const stylesRaw = formData.get("styles");
  const styles = stylesRaw ? JSON.parse(stylesRaw) : null;
  function detectPlatform(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes("xiaohongshu") || host.includes("xhslink")) return "\u5C0F\u7EA2\u4E66";
      if (host.includes("douyin")) return "\u6296\u97F3";
      if (host.includes("kuaishou")) return "\u5FEB\u624B";
      if (host.includes("bilibili")) return "B\u7AD9";
      if (host.includes("weibo")) return "\u5FAE\u535A";
      if (host.includes("tiktok")) return "TikTok";
      return host.split(".")[0];
    } catch {
      return "\u5176\u4ED6";
    }
  }
  __name(detectPlatform, "detectPlatform");
  const platformLink = formData.get("platform_link") ?? "";
  const detectedPlatform = platformLink ? detectPlatform(platformLink) : null;
  if (!nickname) {
    return new Response(JSON.stringify({ error: "\u6635\u79F0\u4E0D\u80FD\u4E3A\u7A7A" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!makeupPhoto) {
    return new Response(JSON.stringify({ error: "\u8BF7\u4E0A\u4F20\u5986\u5BB9\u7167" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const now = Math.floor(Date.now() / 1e3);
  const influencerId = generateId();
  const existing = await env.DB.prepare(
    `SELECT id, status FROM influencers WHERE user_id = ? AND status IN ('pending', 'approved') LIMIT 1`
  ).bind(user.userId).first();
  if (existing) {
    return new Response(
      JSON.stringify({ error: "\u60A8\u5DF2\u6709\u5165\u9A7B\u7533\u8BF7\uFF08\u5F85\u5BA1\u6838\u6216\u5DF2\u901A\u8FC7\uFF09\uFF0C\u8BF7\u52FF\u91CD\u590D\u63D0\u4EA4", existingId: existing.id }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const makeupKey = `influencer/${influencerId}/makeup.jpg`;
  const makeupBuf = await makeupPhoto.arrayBuffer();
  await env.R2_PERM.put(makeupKey, new Blob([makeupBuf]).stream(), {
    httpMetadata: { contentType: makeupPhoto.type || "image/jpeg" }
  });
  const makeupPhotoUrl = `/api/r2-proxy?key=${encodeURIComponent(makeupKey)}&bucket=perm`;
  let barePhotoKey = null;
  if (barePhoto) {
    barePhotoKey = `influencer/${influencerId}/bare.jpg`;
    const bareBuf = await barePhoto.arrayBuffer();
    await env.R2_TEMP.put(barePhotoKey, new Blob([bareBuf]).stream(), {
      httpMetadata: { contentType: barePhoto.type || "image/jpeg" }
    });
  }
  await env.DB.prepare(
    `INSERT INTO influencers (id, user_id, nickname, bio, makeup_photo_url, styles, platform, link1, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(influencerId, user.userId, nickname, bio, makeupPhotoUrl, styles ? JSON.stringify(styles) : null, detectedPlatform, platformLink || null, "pending", now, now).run();
  console.log(`[influencer/apply] Saved influencer record: id=${influencerId}, status=pending`);
  if (barePhotoKey) {
    const analysisPromise = runFaceAnalysis(influencerId, barePhotoKey, env);
    waitUntil(analysisPromise);
  } else {
    await env.DB.prepare(
      `INSERT INTO influencer_face_profile (influencer_id, face_shape, features, tags, updated_at)
       VALUES (?, '\u5706\u8138', ?, ?, ?)`
    ).bind(influencerId, JSON.stringify({ faceShape: "\u5706\u8138", highlight: "\u6C14\u8D28\u4F73" }), "{}", now).run();
  }
  return new Response(
    JSON.stringify({
      id: influencerId,
      status: "pending",
      message: "\u7533\u8BF7\u5DF2\u63D0\u4EA4\uFF0C\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u5BA1\u6838\u5E76\u8054\u7CFB\u60A8..."
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
async function runFaceAnalysis(influencerId, barePhotoKey, env) {
  try {
    const obj = await env.R2_TEMP.get(barePhotoKey);
    if (!obj) {
      console.error(`[influencer/apply] Bare photo not found in R2_TEMP: ${barePhotoKey}`);
      return;
    }
    const photoBuf = await obj.arrayBuffer();
    const photoBase64 = btoa(Array.from(new Uint8Array(photoBuf), (byte) => String.fromCharCode(byte)).join(""));
    const visionPrompt = "\u8BF7\u7528\u4E2D\u6587\u63CF\u8FF0\u8FD9\u5F20\u7167\u7247\u4E2D\u4EBA\u7269\u9762\u90E8\u7279\u5F81\uFF0C\u5305\u62EC\u8138\u578B\u3001\u76AE\u80A4\u7C7B\u578B\u3001\u7709\u6BDB\u5F62\u72B6\u3001\u773C\u775B\u5F62\u72B6\u3001\u4E09\u5EAD\u4E94\u773C\u6BD4\u4F8B\u3001\u5BF9\u79F0\u5EA6\u3002\u63CF\u8FF0\u8981\u4E13\u4E1A\u4E14\u7B80\u6D01\uFF0C\u6BCF\u70B9\u4E00\u53E5\u8BDD\u3002\u53EA\u8F93\u51FA\u63CF\u8FF0\uFF0C\u4E0D\u8981\u5176\u4ED6\u5185\u5BB9\u3002";
    const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.DASHSCOPE_API_KEY}` },
      body: JSON.stringify({
        model: "qwen-vl-max",
        messages: [{ role: "user", content: [{ type: "text", text: visionPrompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photoBase64}` } }] }],
        max_tokens: 500,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(25e3)
    });
    if (!resp.ok) {
      console.error(`[influencer/apply] DashScope vision error: ${resp.status}`);
      return;
    }
    const data = await resp.json();
    const textDesc = data?.choices?.[0]?.message?.content?.trim();
    if (!textDesc) {
      console.error("[influencer/apply] DashScope returned empty description");
      return;
    }
    console.log(`[influencer/apply] Vision OK, desc len: ${textDesc.length}`);
    const dsKey = env.DEEPSEEK_API_KEY;
    if (!dsKey) {
      console.error("[influencer/apply] DEEPSEEK_API_KEY not configured, skipping DeepSeek");
      return;
    }
    const dsPrompt = `You are a professional beauty consultant. Based on the following face description, select exactly one option from each category and provide personalized advice.

[Face Description]
${textDesc}

faceShape: \u9E45\u86CB\u8138, \u5706\u8138, \u65B9\u8138, \u957F\u8138, \u5FC3\u5F62\u8138, \u83F1\u5F62\u8138, \u65B9\u5F62\u8138
skinType: \u5E72\u6027, \u6CB9\u6027, \u6DF7\u5408\u808C, \u654F\u611F\u6027, \u4E2D\u6027\u504F\u5E72
eyebrowShape: \u4E00\u5B57\u7709, \u67F3\u53F6\u7709, \u62F1\u7709, \u5E73\u7709, \u6311\u7709, \u65AD\u7709, \u7EC6\u7709
eyeShape: \u51E4\u773C, \u6843\u82B1\u773C, \u5706\u773C, \u7EC6\u957F\u773C, \u6C34\u6EF4\u773C, \u4E0B\u5782\u773C, \u53CC\u773C\u76AE
threeFiveRatio: \u4E0A\u4E2D\u4E0B\u5747\u8861, \u4E2D\u5EAD\u504F\u957F, \u4E2D\u5EAD\u504F\u77ED, \u4E0A\u5EAD\u504F\u5BBD, \u4E0B\u5EAD\u504F\u7A84, \u4E09\u5EAD\u504F\u77ED
symmetry: \u9AD8\u5BF9\u79F0\u5EA6, \u4E2D\u7B49\u5BF9\u79F0\u5EA6, \u4F4E\u5BF9\u79F0\u5EA6
personaTags: \u751C\u7F8E\u53EF\u7231, \u6C14\u8D28\u4F18\u96C5, \u77E5\u6027\u6E29\u5A49, \u5FA1\u59D0\u9738\u6C14, \u6E05\u7EAF\u90BB\u5BB6, \u9177\u98D2\u4E2A\u6027

Return a JSON object with these exact keys:
{
  "faceShape": "one of the options above",
  "skinType": "one of the options above",
  "eyebrowShape": "one of the options above",
  "eyeShape": "one of the options above",
  "threeFiveRatio": "one of the options above",
  "symmetry": "one of the options above",
  "personaTags": "one of the options above",
  "highlight": "A one-sentence catchy compliment that highlights the user's most distinctive beauty feature, written in natural Chinese. Keep it warm and personal, around 10-20 Chinese characters.",
  "suggestions": ["3-5 specific, actionable makeup or skincare tips in Chinese, each around 10-20 characters."]
}`;
    const dsResp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${dsKey}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: dsPrompt }], max_tokens: 500, temperature: 0.3 }),
      signal: AbortSignal.timeout(25e3)
    });
    if (!dsResp.ok) {
      console.error(`[influencer/apply] DeepSeek error: ${dsResp.status}`);
      return;
    }
    const dsData = await dsResp.json();
    const raw = dsData?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error("[influencer/apply] DeepSeek response has no content");
      return;
    }
    const report = parseDeepseekJson(raw);
    if (!report) {
      console.error("[influencer/apply] DeepSeek returned invalid JSON");
      return;
    }
    let faceShape = String(report.faceShape ?? "\u5706\u8138");
    let tags = "{}";
    let features = "";
    try {
      tags = JSON.stringify({
        faceShape: report.faceShape,
        skinType: report.skinType,
        eyebrowShape: report.eyebrowShape,
        eyeShape: report.eyeShape,
        threeFiveRatio: report.threeFiveRatio,
        symmetry: report.symmetry,
        personaTags: report.personaTags
      });
      features = JSON.stringify({
        faceShape,
        highlight: report.highlight,
        suggestions: Array.isArray(report.suggestions) ? report.suggestions : []
      });
    } catch (e) {
      console.error(`[influencer/apply] Failed to serialize report: ${e}`);
      return;
    }
    console.log(`[influencer/apply] DeepSeek OK, faceShape=${faceShape}`);
    const now = Math.floor(Date.now() / 1e3);
    await env.DB.prepare(
      `INSERT INTO influencer_face_profile (influencer_id, face_shape, features, tags, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(influencerId, faceShape, features, tags, now).run();
    console.log(`[influencer/apply] Wrote face_profile for ${influencerId}`);
    await env.R2_TEMP.delete(barePhotoKey);
    console.log(`[influencer/apply] Deleted bare photo from R2_TEMP: ${barePhotoKey}`);
  } catch (e) {
    console.error(`[influencer/apply] Background analysis failed for ${influencerId}:`, e);
  }
}
__name(runFaceAnalysis, "runFaceAnalysis");
var onRequestPost19 = /* @__PURE__ */ __name(async (...args) => {
  return POST19(...args);
}, "onRequestPost");

// api/influencers/match.ts
var FACE_DIMS = ["faceShape", "skinType", "eyebrowShape", "eyeShape", "threeFiveRatio", "symmetry"];
var FACE_WEIGHT = 0.5;
var STYLE_WEIGHT = 0.3;
var DEMAND_WEIGHT = 0.1;
var GET10 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const userId = user.userId;
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(userId).first();
  if (!tier1Row) {
    return new Response(
      JSON.stringify({ error: "no_tier1_data", message: "\u8BF7\u5148\u5B8C\u6210\u62CD\u7167\u5206\u6790" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  let tier1;
  try {
    tier1 = JSON.parse(tier1Row.report_data);
  } catch {
    return new Response(JSON.stringify({ error: "tier1 \u6570\u636E\u89E3\u6790\u5931\u8D25" }), { status: 500 });
  }
  const getUserFace = /* @__PURE__ */ __name((key) => typeof tier1[key] === "string" ? tier1[key] : void 0, "getUserFace");
  const userPersonaTag = typeof tier1.personaTags === "string" ? tier1.personaTags : void 0;
  const tier3Row = await env.DB.prepare(
    `SELECT quiz_answers, scenario FROM reports_tier3 WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(userId).first();
  const userMakeupStyle = tier3Row ? (() => {
    try {
      const qa = JSON.parse(tier3Row.quiz_answers);
      return typeof qa.makeupStyle === "string" ? qa.makeupStyle : void 0;
    } catch {
      return void 0;
    }
  })() : void 0;
  const influencersRow = await env.DB.prepare(
    `SELECT i.id, i.nickname, i.bio, i.makeup_photo_url, i.platform, i.link1, i.link2,
            i.styles, fp.tags
     FROM influencers i
     LEFT JOIN influencer_face_profile fp ON fp.influencer_id = i.id
     WHERE i.status = 'approved'`
  ).all();
  const influencers = influencersRow.results ?? [];
  const scored = influencers.map((inf) => {
    let fpFace = {};
    try {
      fpFace = JSON.parse(inf.tags || "{}");
    } catch {
    }
    const getInfFace = /* @__PURE__ */ __name((key) => typeof fpFace[key] === "string" ? fpFace[key] : void 0, "getInfFace");
    let faceMatchCount = 0;
    for (const dim of FACE_DIMS) {
      const u = getUserFace(dim);
      const inf2 = getInfFace(dim);
      if (u && inf2 && u === inf2) faceMatchCount++;
    }
    const faceScore = faceMatchCount / FACE_DIMS.length * FACE_WEIGHT;
    const userStylePref = userMakeupStyle || userPersonaTag;
    let styleScore = 0;
    if (userStylePref) {
      let infStyles = [];
      try {
        infStyles = JSON.parse(inf.styles || "[]");
      } catch {
      }
      let infPersonaTags = [];
      if (typeof fpFace.personaTags === "string") {
        infPersonaTags = [fpFace.personaTags];
      }
      const allInfStyles = [...infStyles, ...infPersonaTags];
      if (allInfStyles.some((s) => s === userStylePref)) {
        styleScore = STYLE_WEIGHT;
      }
    }
    const demandScore = tier3Row ? DEMAND_WEIGHT : 0;
    return {
      id: inf.id,
      nickname: inf.nickname,
      bio: inf.bio,
      makeupPhotoUrl: inf.makeup_photo_url,
      platform: inf.platform,
      link1: inf.link1,
      link2: inf.link2,
      score: Math.round((faceScore + styleScore + demandScore) * 100) / 100
    };
  });
  scored.sort((a, b) => b.score - a.score);
  const matches = scored.slice(0, 2);
  return new Response(JSON.stringify({ matches }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var onRequestGet10 = /* @__PURE__ */ __name(async (...args) => {
  return GET10(...args);
}, "onRequestGet");

// api/influencers/mine.ts
var GET11 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const record = await env.DB.prepare(
    `SELECT id, user_id, nickname, bio, makeup_photo_url, platform, link1, link2,
            status, reject_reason, created_at, updated_at
     FROM influencers
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`
  ).bind(user.userId).first();
  if (!record) {
    return new Response(JSON.stringify({ exists: false }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({
    exists: true,
    id: record.id,
    nickname: record.nickname,
    status: record.status,
    submittedAt: record.created_at,
    rejectReason: record.reject_reason
  }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var onRequestGet11 = /* @__PURE__ */ __name(async (...args) => {
  return GET11(...args);
}, "onRequestGet");

// api/orders/create.ts
var POST20 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { channel, purpose } = body;
  const now = Math.floor(Date.now() / 1e3);
  const orderId = generateId();
  const outTradeNo = `BEAUTY${Date.now()}${generateId().slice(0, 4)}`;
  const orderPurpose = purpose ?? "token_purchase";
  const priceRow = await env.DB.prepare(
    `SELECT value FROM app_config WHERE key = 'tier3_token_price'`
  ).first();
  const amount = priceRow ? parseInt(priceRow.value, 10) : 660;
  await env.DB.prepare(
    `INSERT INTO orders (id, user_id, amount, channel, status, out_trade_no, purpose, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).bind(orderId, user.userId, amount, channel ?? "mock", outTradeNo, orderPurpose, now).run();
  const payUrl = `/mock-pay.html?orderId=${orderId}`;
  return new Response(
    JSON.stringify({ orderId, payUrl, outTradeNo, amount }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
var onRequestPost20 = /* @__PURE__ */ __name(async (...args) => {
  return POST20(...args);
}, "onRequestPost");

// api/orders/mock-pay-confirm.ts
var POST21 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { orderId } = body;
  if (!orderId) {
    return new Response(JSON.stringify({ error: "orderId \u4E0D\u80FD\u4E3A\u7A7A" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const order = await env.DB.prepare(
    `SELECT * FROM orders WHERE id = ?`
  ).bind(orderId).first();
  if (!order) {
    return new Response(JSON.stringify({ error: "\u8BA2\u5355\u4E0D\u5B58\u5728" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (order.status !== "pending") {
    return new Response(JSON.stringify({ error: "\u8BA2\u5355\u72B6\u6001\u4E0D\u4E3A pending", orderId, status: order.status }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const now = Math.floor(Date.now() / 1e3);
  let tokenRedeemCode = null;
  await env.DB.prepare(
    `UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?`
  ).bind(now, orderId).run();
  if (order.purpose === "token_purchase") {
    const tokenId = generateId();
    const redeemCode = generateRedeemCode();
    await env.DB.prepare(
      `INSERT INTO tokens (id, status, user_id, price, order_id, redeem_code, created_at)
       VALUES (?, 'unused', ?, ?, ?, ?, ?)`
    ).bind(tokenId, order.user_id, order.amount, orderId, redeemCode, now).run();
    await env.DB.prepare(
      `UPDATE orders SET token_id = ? WHERE id = ?`
    ).bind(tokenId, orderId).run();
    tokenRedeemCode = redeemCode;
  } else if (order.purpose === "influencer_apply") {
    await env.DB.prepare(
      `UPDATE influencers SET status = 'pending', updated_at = ?
       WHERE order_id = ? AND status = 'pending_payment'`
    ).bind(now, orderId).run();
  }
  return new Response(
    JSON.stringify({ success: true, orderId, purpose: order.purpose, redeemCode: tokenRedeemCode }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
function generateRedeemCode() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return code;
}
__name(generateRedeemCode, "generateRedeemCode");
var onRequestPost21 = /* @__PURE__ */ __name(async (...args) => {
  return POST21(...args);
}, "onRequestPost");

// api/reports/mine.ts
var GET12 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  console.log("[mine] context keys=", Object.keys(context), "request=", typeof context.request);
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const now = Math.floor(Date.now() / 1e3);
  const today = beijingDate();
  const todayStartUnix = Math.floor(
    (/* @__PURE__ */ new Date(today + "T00:00:00+08:00")).getTime() / 1e3
  );
  const todayEndUnix = todayStartUnix + 24 * 60 * 60;
  const tier2Result = await env.DB.prepare(
    `SELECT id, content, scenario, created_at
     FROM reports_tier2
     WHERE user_id = ?
       AND unlock_method IN ('ad', 'code', 'share')
       AND created_at >= ?
       AND created_at < ?`
  ).bind(user.userId, todayStartUnix, todayEndUnix).all();
  const tier3Result = await env.DB.prepare(
    `SELECT id, scenario, content, created_at, expire_at
     FROM reports_tier3
     WHERE user_id = ? AND expire_at > ?
     ORDER BY created_at DESC`
  ).bind(user.userId, now).all();
  const rows = [
    ...(tier2Result.results ?? []).map((r) => ({
      tier: 2,
      id: r.id,
      scenario: r.scenario ?? null,
      content: r.content,
      access_type: "share_unlock",
      created_at: r.created_at,
      expire_at: null
    })),
    ...(tier3Result.results ?? []).map((r) => ({
      tier: 3,
      id: r.id,
      scenario: r.scenario,
      content: r.content,
      access_type: "regular",
      created_at: r.created_at,
      expire_at: r.expire_at
    }))
  ];
  rows.sort(
    (a, b) => a.tier !== b.tier ? a.tier - b.tier : b.created_at - a.created_at
  );
  const reports = rows.map((r) => {
    const daysLeft = r.access_type === "regular" && r.expire_at !== null ? Math.max(0, Math.ceil((r.expire_at - now) / 86400)) : null;
    return {
      id: r.id,
      tier: r.tier,
      scenario: r.scenario,
      content: r.content,
      access_type: r.access_type,
      createdAt: r.created_at,
      expireAt: r.expire_at,
      daysLeft
    };
  });
  return new Response(JSON.stringify({ reports }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var onRequestGet12 = /* @__PURE__ */ __name(async (...args) => {
  return GET12(...args);
}, "onRequestGet");

// api/test/get-test.ts
var GET13 = /* @__PURE__ */ __name(async (context) => {
  return new Response(JSON.stringify({ message: "hello from get-test" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var onRequestGet13 = /* @__PURE__ */ __name(async (...args) => GET13(args[0]), "onRequestGet");

// api/test/md5-test.ts
var GET14 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  await requireAuth(request, env);
  let md5Result = "not_available";
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode("test");
    const hashBuffer = await crypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    md5Result = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  } catch (e) {
    md5Result = "error: " + String(e);
  }
  return new Response(JSON.stringify({ md5Result }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var onRequestGet14 = /* @__PURE__ */ __name(async (...args) => GET14(args[0]), "onRequestGet");

// api/test/r2-check.ts
var GET15 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  const key = "face-photos/user-test/tier1-test-001.jpg";
  const obj = await env.R2_TEMP.get(key);
  return new Response(JSON.stringify({
    exists: !!obj,
    hasBody: obj ? "body" in obj : false,
    hasArrayBuffer: obj ? typeof obj.arrayBuffer : "n/a",
    key: obj?.key,
    size: obj?.size
  }));
}, "GET");
var onRequestGet15 = /* @__PURE__ */ __name(async (...args) => GET15(...args), "onRequestGet");

// api/test/tb-debug.ts
var GET16 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  const user = await requireAuth(request, env);
  if (!user) return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), { status: 401 });
  const url = new URL(request.url);
  const keyword = url.searchParams.get("q") || "SK-II \u795E\u4ED9\u6C34";
  try {
    const products = await searchTaobaoProducts(keyword, env, 5);
    const product = await findProductByKeyword(keyword, env);
    return new Response(JSON.stringify({
      keyword,
      searchCount: products.length,
      found: !!product,
      product: product ? {
        title: product.title,
        price: product.price,
        hasImage: !!product.imageUrl,
        imageUrl: product.imageUrl?.substring(0, 80),
        itemUrl: product.itemUrl?.substring(0, 80)
      } : null
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), keyword }), { status: 500 });
  }
}, "GET");
var onRequestGet16 = /* @__PURE__ */ __name(async (...args) => GET16(args[0]), "onRequestGet");

// api/test/unlock-debug.ts
var POST22 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const body = await request.json();
  const { reportId } = body;
  const log = [];
  const tier2Row = await env.DB.prepare(
    `SELECT id, user_id, share_token FROM reports_tier2 WHERE id = ? LIMIT 1`
  ).bind(reportId).first();
  log.push("tier2Row: " + JSON.stringify(tier2Row));
  if (!tier2Row) {
    log.push("ERROR: tier2Row not found");
    return new Response(JSON.stringify({ log }));
  }
  if (!tier2Row.share_token) {
    log.push("ERROR: no share_token");
    return new Response(JSON.stringify({ log }));
  }
  log.push("share_token: " + tier2Row.share_token);
  const referralRow = await env.DB.prepare(
    `SELECT converted_user_id FROM share_referrals WHERE token = ? LIMIT 1`
  ).bind(tier2Row.share_token).first();
  log.push("referralRow: " + JSON.stringify(referralRow));
  if (!referralRow || !referralRow.converted_user_id) {
    log.push("ERROR: referral not converted");
    return new Response(JSON.stringify({ log }));
  }
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = (SELECT source_tier1_report_id FROM reports_tier2 WHERE id = ?) LIMIT 1`
  ).bind(reportId).first();
  log.push("tier1Row: " + JSON.stringify(tier1Row)?.substring(0, 200));
  if (!tier1Row?.report_data) {
    log.push("ERROR: no tier1 report_data");
    return new Response(JSON.stringify({ log }));
  }
  let facePhotoKey = null;
  try {
    const tier1Report = JSON.parse(tier1Row.report_data);
    facePhotoKey = tier1Report.facePhotoKey;
  } catch (e) {
    log.push("ERROR parsing tier1: " + String(e));
    return new Response(JSON.stringify({ log }));
  }
  log.push("facePhotoKey: " + facePhotoKey);
  if (!facePhotoKey) {
    log.push("ERROR: no facePhotoKey");
    return new Response(JSON.stringify({ log }));
  }
  const obj = await env.R2_TEMP.get(facePhotoKey);
  log.push("R2 obj exists: " + !!obj + ", hasBody: " + (obj ? "body" in obj : false));
  if (!obj) {
    log.push("ERROR: R2 object not found");
    return new Response(JSON.stringify({ log }));
  }
  if (!("body" in obj)) {
    log.push("ERROR: R2 object has no body property");
    return new Response(JSON.stringify({ log }));
  }
  try {
    const arrayBuffer = await obj.arrayBuffer();
    const b64 = btoa(Array.from(new Uint8Array(arrayBuffer), (byte) => String.fromCharCode(byte)).join(""));
    log.push("SUCCESS: read " + arrayBuffer.byteLength + " bytes, b64 length: " + b64.length);
    log.push("b64 prefix: " + b64.substring(0, 50));
  } catch (e) {
    log.push("ERROR reading body: " + String(e));
  }
  return new Response(JSON.stringify({ log }));
}, "POST");
var onRequestPost22 = /* @__PURE__ */ __name(async (...args) => POST22(...args), "onRequestPost");

// _image_utils.ts
var MIN_DIM = 512;
var MAX_SIDE = 2048;
function readJpegDimensions(buf) {
  const bytes = new Uint8Array(buf);
  if (bytes[0] !== 255 || bytes[1] !== 216) return null;
  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 255) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    const isSOF = marker >= 192 && marker <= 195 || marker >= 197 && marker <= 199 || marker >= 201 && marker <= 203 || marker >= 205 && marker <= 207;
    if (isSOF) {
      const h = bytes[offset + 5] << 8 | bytes[offset + 6];
      const w = bytes[offset + 7] << 8 | bytes[offset + 8];
      return { width: w, height: h };
    }
    const segLen = bytes[offset + 2] << 8 | bytes[offset + 3];
    offset += 2 + segLen;
  }
  return null;
}
__name(readJpegDimensions, "readJpegDimensions");
function calcTargetDims(w, h, targetSide, minWidth) {
  let newW, newH;
  if (w >= h) {
    newW = targetSide;
    newH = Math.round(h / w * targetSide);
  } else {
    newH = targetSide;
    newW = Math.round(w / h * targetSide);
  }
  if (newW < minWidth || newH < minWidth) {
    const scale = minWidth / Math.min(w, h);
    newW = Math.round(w * scale);
    newH = Math.round(h * scale);
  }
  return { newW, newH };
}
__name(calcTargetDims, "calcTargetDims");
async function resizeBase64IfNeeded(dataUrl, maxWidth = MAX_SIDE, minWidth = MIN_DIM) {
  const commaIdx = dataUrl.indexOf(",");
  const rawB64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binaryStr = Array.from(atob(rawB64), (c) => c.charCodeAt(0));
  const uint8 = new Uint8Array(binaryStr);
  const dims = readJpegDimensions(uint8.buffer);
  if (dims) {
    const { width, height } = dims;
    if (width >= minWidth && height >= minWidth && width <= maxWidth && height <= maxWidth) {
      return dataUrl;
    }
  }
  const _global = globalThis;
  const CanvasCtor = _global["createCanvas"] || _global["Canvas"];
  if (!CanvasCtor) {
    console.log("[resizeBase64] Canvas not available, skipping resize");
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width >= minWidth && height >= minWidth && width <= maxWidth && height <= maxWidth) {
        resolve(dataUrl);
        return;
      }
      const dims2 = calcTargetDims(width, height, maxWidth, minWidth);
      if (!dims2) {
        resolve(dataUrl);
        return;
      }
      const { newW, newH } = dims2;
      try {
        const canvas = new CanvasCtor(newW, newH);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, newW, newH);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (e) {
        console.error("[resizeBase64] Canvas error:", e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      console.error("[resizeBase64] Image load error");
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}
__name(resizeBase64IfNeeded, "resizeBase64IfNeeded");

// api/tier1/analyze.ts
var POST23 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const authUser = await requireAuth(request, env);
  if (!authUser) {
    return new Response(JSON.stringify({ error: "\u672A\u6388\u6743" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const today = beijingDate();
  const todayStartUnix = Math.floor((/* @__PURE__ */ new Date(today + "T00:00:00+08:00")).getTime() / 1e3);
  const todayEndUnix = todayStartUnix + 24 * 60 * 60;
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM reports_tier1 WHERE user_id = ? AND created_at >= ? AND created_at < ?`
  ).bind(authUser.userId, todayStartUnix, todayEndUnix).first();
  const todayCount = countResult?.cnt ?? 0;
  if (todayCount >= 2) {
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "\u4ECA\u65E5\u521D\u8BC6\u6B21\u6570\u5DF2\u7528\u5B8C\uFF0C\u660E\u5929\u518D\u6765\u5427" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }
  let photoBase64;
  if (request.headers.get("content-type")?.includes("multipart")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("photo");
    if (file) {
      const buf = await file.arrayBuffer();
      const b64 = btoa(Array.from(new Uint8Array(buf), (byte) => String.fromCharCode(byte)).join(""));
      photoBase64 = `data:${file.type || "image/jpeg"};base64,${b64}`;
      photoBase64 = await resizeBase64IfNeeded(photoBase64, 2048);
    }
  }
  if (photoBase64 && photoBase64.length > 15e5) {
    console.warn(`[tier1/analyze] photoBase64 too large (${photoBase64.length} chars), forcing resize to 1024px`);
    photoBase64 = await resizeBase64IfNeeded(photoBase64, 1024);
    console.log(`[tier1/analyze] After forced resize: ${photoBase64.length} chars`);
  }
  const now = Math.floor(Date.now() / 1e3);
  const reportId = generateId();
  let facePhotoKey = null;
  if (photoBase64) {
    try {
      facePhotoKey = `face-photos/${authUser.userId}/${reportId}.jpg`;
      const commaIdx = photoBase64.indexOf(",");
      const rawB64 = commaIdx >= 0 ? photoBase64.slice(commaIdx + 1) : photoBase64;
      const binaryStr = Array.from(atob(rawB64), (c) => c.charCodeAt(0));
      const blob = new Blob([new Uint8Array(binaryStr)], { type: "image/jpeg" });
      await env.R2_TEMP.put(facePhotoKey, blob.stream(), { httpMetadata: { contentType: "image/jpeg" } });
      console.log(`[tier1/analyze] Face photo uploaded to R2: ${facePhotoKey}`);
    } catch (e) {
      console.error("[tier1/analyze] R2 upload failed, continuing without photo reference:", e);
      facePhotoKey = null;
    }
  }
  let faceCount = -1;
  if (photoBase64) {
    const apiKey = env.DASHSCOPE_API_KEY;
    if (apiKey) {
      const faceCheckPrompt = `Count the number of clearly visible human faces in this image. Reply with ONLY a single integer (e.g. 0, 1, 2, 3...). Do not write any other text.`;
      try {
        const faceCheckResp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "qwen-vl-max",
            messages: [{ role: "user", content: [{ type: "text", text: faceCheckPrompt }, { type: "image_url", image_url: { url: photoBase64 } }] }],
            max_tokens: 10,
            temperature: 0
          }),
          signal: AbortSignal.timeout(15e3)
        });
        if (faceCheckResp.ok) {
          const faceData = await faceCheckResp.json();
          const faceText = faceData?.choices?.[0]?.message?.content?.trim() ?? "";
          const parsed = parseInt(faceText, 10);
          if (!isNaN(parsed) && parsed >= 0) {
            faceCount = parsed;
            console.log(`[tier1/analyze] Face count check: ${faceCount} face(s) detected`);
          } else {
            console.warn(`[tier1/analyze] Face count parse failed, got: "${faceText}", defaulting to -1`);
          }
        } else {
          console.warn(`[tier1/analyze] Face count check API error ${faceCheckResp.status}, skipping validation`);
        }
      } catch (e) {
        console.warn("[tier1/analyze] Face count check timeout/error, continuing without validation:", e);
      }
    }
  }
  if (faceCount === 0) {
    return new Response(
      JSON.stringify({ error: "no_face_detected", message: "\u672A\u68C0\u6D4B\u5230\u4EBA\u8138\uFF0C\u8BF7\u4E0A\u4F20\u6E05\u6670\u7684\u6B63\u8138\u7167\u7247" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (faceCount >= 2) {
    return new Response(
      JSON.stringify({ error: "multiple_faces", message: "\u68C0\u6D4B\u5230\u591A\u5F20\u4EBA\u8138\uFF0C\u8BF7\u4E0A\u4F20\u4EC5\u5305\u542B\u60A8\u672C\u4EBA\u7684\u7167\u7247" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (faceCount === 1) {
    console.log("[tier1/analyze] Face count validated: exactly 1 face, proceeding to analysis");
  }
  let textDesc = "";
  if (photoBase64) {
    const apiKey = env.DASHSCOPE_API_KEY;
    if (apiKey) {
      const visionPrompt = `Please observe this front-facing face photo and describe these visual features in Chinese natural language (no enum labels): face shape contour, eyebrow shape/density, eye morphology, skin condition, three-court proportions, facial symmetry. One paragraph per feature.`;
      const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "qwen-vl-max", messages: [{ role: "user", content: [{ type: "text", text: visionPrompt }, { type: "image_url", image_url: { url: photoBase64 } }] }], max_tokens: 500, temperature: 0.3 }),
        signal: AbortSignal.timeout(2e4)
      });
      if (resp.ok) {
        const data = await resp.json();
        textDesc = data?.choices?.[0]?.message?.content?.trim() ?? "";
        if (textDesc) console.log(`[tier1/analyze] Vision OK, desc len: ${textDesc.length}, preview: ${textDesc.slice(0, 80)}`);
      } else {
        console.error(
          "[tier1/analyze] DashScope vision error",
          resp.status,
          ` (photoBase64 length: ${photoBase64 ? photoBase64.length : 0}, status: ${resp.status})`
        );
      }
    }
  }
  const saveReport = /* @__PURE__ */ __name(async (reportData) => {
    const fullData = { ...reportData, facePhotoKey };
    await env.DB.prepare(
      `INSERT INTO reports_tier1 (id, user_id, report_data, created_at) VALUES (?, ?, ?, ?)`
    ).bind(reportId, authUser.userId, JSON.stringify(fullData), now).run();
  }, "saveReport");
  if (!textDesc) {
    console.warn("[tier1/analyze] No vision description, falling back to placeholder report");
    const ph = { faceShape: "\u5706\u8138", skinType: "\u6DF7\u5408\u808C", eyebrowShape: "\u4E00\u5B57\u7709", eyeShape: "\u674F\u773C", threeFiveRatio: "\u6BD4\u4F8B\u5747\u8861\u578B", symmetry: "\u9AD8\u5BF9\u79F0\u5EA6", personaTags: "\u6E29\u67D4\u77E5\u6027\u98CE", highlight: "\u4F60\u7684\u4E94\u5B98\u6BD4\u4F8B\u5F88\u6709\u8FA8\u8BC6\u5EA6\uFF0C\u5C5E\u4E8E\u8010\u770B\u578B", suggestions: ["\u5EFA\u8BAE\u5C1D\u8BD5\u6A58\u8272\u7CFB\u5986\u5BB9\u63D0\u6C14\u8272"] };
    await saveReport(ph);
    return new Response(JSON.stringify({ report: ph, reportId }), { headers: { "Content-Type": "application/json" } });
  }
  const dsApiKey = env.DEEPSEEK_API_KEY;
  let report = {};
  if (dsApiKey) {
    const prompt = `You are a professional beauty consultant. Based on the following face description, select exactly one option from each category and provide personalized advice.

[Face Description]
${textDesc}

faceShape: \u9E45\u86CB\u8138, \u5706\u8138, \u65B9\u8138, \u957F\u8138, \u5FC3\u5F62\u8138, \u83F1\u5F62\u8138, \u68A8\u5F62\u8138
skinType: \u5E72\u6027, \u6CB9\u6027, \u6DF7\u5408\u808C, \u4E2D\u6027, \u654F\u611F\u808C
eyebrowShape: \u4E00\u5B57\u7709, \u67F3\u53F6\u7709, \u5251\u7709, \u5F2F\u7709, \u5E73\u7709, \u7C97\u7709, \u7EC6\u7709
eyeShape: \u674F\u773C, \u4E39\u51E4\u773C, \u5706\u773C, \u6843\u82B1\u773C, \u72D0\u72F8\u773C, \u4E0B\u5782\u773C, \u6DF1\u9083\u773C
threeFiveRatio: \u6BD4\u4F8B\u5747\u8861\u578B, \u4E0A\u5EAD\u504F\u957F\u578B, \u4E2D\u5EAD\u504F\u957F\u578B, \u4E0B\u5EAD\u504F\u957F\u578B, \u4E94\u773C\u504F\u5BBD\u578B, \u4E94\u773C\u504F\u7A84\u578B
symmetry: \u9AD8\u5BF9\u79F0\u5EA6, \u4E2D\u7B49\u5BF9\u79F0\u5EA6, \u81EA\u7136\u4E0D\u5BF9\u79F0\uFF08\u5E26\u4E2A\u6027\uFF09
personaTags: \u6E29\u67D4\u77E5\u6027\u98CE, \u5143\u6C14\u5C11\u5973\u98CE, \u9AD8\u7EA7\u51B7\u8273\u98CE, \u90BB\u5BB6\u751C\u7F8E\u98CE, \u98D2\u723D\u82F1\u6C14\u98CE, \u590D\u53E4\u6587\u827A\u98CE, \u6E05\u51B7\u4ED9\u6C14\u98CE, \u8FA3\u59B9\u6D3B\u529B\u98CE

Output strict JSON only, with these exact keys:
{
  "faceShape": "one of the options above",
  "skinType": "one of the options above",
  "eyebrowShape": "one of the options above",
  "eyeShape": "one of the options above",
  "threeFiveRatio": "one of the options above",
  "symmetry": "one of the options above",
  "personaTags": "one of the options above",
  "highlight": "A one-sentence catchy compliment that highlights the user's most distinctive beauty feature, written in natural Chinese. Keep it warm and personal, around 10-20 Chinese characters.",
  "suggestions": ["3-5 specific, actionable makeup or skincare tips in Chinese, each around 10-20 characters. Make them tailored to the identified features."]
}`;
    console.log(`[tier1/analyze] Calling DeepSeek with desc len: ${textDesc.length}`);
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${dsApiKey}` },
      body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "user", content: prompt }], max_tokens: 500, temperature: 0.3 }),
      signal: AbortSignal.timeout(2e4)
    });
    if (resp.ok) {
      const data = await resp.json();
      const raw = data?.choices?.[0]?.message?.content;
      if (raw) {
        if (report) {
          console.log(`[tier1/analyze] DeepSeek OK, parsed report keys: ${Object.keys(report).join(", ")}, highlight=${String(report.highlight)?.slice(0, 40)}, suggestions count=${Array.isArray(report.suggestions) ? report.suggestions.length : 0}`);
        } else {
          console.error("[tier1/analyze] Invalid DeepSeek JSON response");
        }
      } else {
        console.error("[tier1/analyze] DeepSeek response has no content in choices[0].message");
      }
    } else {
      const errBody = await resp.text().catch(() => "");
      console.error(`[tier1/analyze] DeepSeek error ${resp.status}: ${errBody.slice(0, 300)}`);
    }
  } else {
    console.warn("[tier1/analyze] DEEPSEEK_API_KEY not set, skipping DeepSeek call");
  }
  const defaults = { faceShape: "\u5706\u8138", skinType: "\u6DF7\u5408\u808C", eyebrowShape: "\u4E00\u5B57\u7709", eyeShape: "\u674F\u773C", threeFiveRatio: "\u6BD4\u4F8B\u5747\u8861\u578B", symmetry: "\u9AD8\u5BF9\u79F0\u5EA6", personaTags: "\u6E29\u67D4\u77E5\u6027\u98CE" };
  for (const [k, v] of Object.entries(defaults)) {
    if (!report[k]) report[k] = v;
  }
  if (!report.highlight) {
    report.highlight = "\u4F60\u7684\u4E94\u5B98\u6BD4\u4F8B\u5F88\u6709\u8FA8\u8BC6\u5EA6\uFF0C\u5C5E\u4E8E\u8010\u770B\u578B";
    console.log("[tier1/analyze] highlight missing from DeepSeek, using default");
  }
  if (Array.isArray(report.suggestions) && report.suggestions.length > 0) {
    console.log(`[tier1/analyze] suggestions from DeepSeek: ${report.suggestions.length} items`);
  } else {
    const fallbackSuggestions = [];
    if (report.faceShape === "\u5706\u8138") fallbackSuggestions.push("\u5EFA\u8BAE\u5C1D\u8BD5\u7565\u5E26\u68F1\u89D2\u7684\u7709\u5F62\u62C9\u957F\u8138\u90E8\u89C6\u89C9\u6BD4\u4F8B");
    if (report.skinType === "\u6DF7\u5408\u808C") fallbackSuggestions.push("T\u533A\u63A7\u6CB9\u3001U\u533A\u4FDD\u6E7F\uFF0C\u5206\u533A\u62A4\u7406\u6548\u679C\u66F4\u4F73");
    if (report.skinType === "\u5E72\u6027\u808C") fallbackSuggestions.push("\u5986\u524D\u505A\u597D\u4FDD\u6E7F\uFF0C\u9009\u62E9\u6ECB\u6DA6\u578B\u5E95\u5986\u4EA7\u54C1");
    if (report.skinType === "\u6CB9\u6027\u808C") fallbackSuggestions.push("\u5B9A\u5986\u662F\u5173\u952E\uFF0C\u5EFA\u8BAE\u9009\u62E9\u6301\u5986\u578B\u7C89\u5E95\u548C\u6563\u7C89");
    if (report.eyeShape === "\u4E39\u51E4\u773C") fallbackSuggestions.push("\u773C\u7EBF\u53EF\u5FAE\u5FAE\u4E0A\u6311\uFF0C\u7A81\u51FA\u4E1C\u65B9\u97F5\u5473");
    if (report.eyeShape === "\u674F\u773C") fallbackSuggestions.push("\u9002\u5408\u6E29\u67D4\u7CFB\u773C\u5986\uFF0C\u5927\u5730\u8272\u7CFB\u773C\u5F71\u5F88\u767E\u642D");
    if (report.eyebrowShape === "\u4E00\u5B57\u7709") fallbackSuggestions.push("\u4FDD\u6301\u7709\u5F62\u5E72\u51C0\uFF0C\u53EF\u9002\u5F53\u52A0\u4E00\u70B9\u5F27\u5EA6\u66F4\u67D4\u548C");
    if (fallbackSuggestions.length === 0) fallbackSuggestions.push("\u6839\u636E\u4F60\u7684\u9762\u90E8\u7279\u5F81\uFF0C\u4E2A\u6027\u5316\u5986\u5BB9\u5EFA\u8BAE\u6B63\u5728\u751F\u6210\u4E2D");
    report.suggestions = fallbackSuggestions;
    console.log(`[tier1/analyze] suggestions from fallback rules: ${fallbackSuggestions.length} items`);
  }
  await saveReport(report);
  return new Response(JSON.stringify({ report, reportId }), { headers: { "Content-Type": "application/json" } });
}, "POST");
var onRequestPost23 = /* @__PURE__ */ __name(async (...args) => {
  return POST23(...args);
}, "onRequestPost");

// api/tier1/confirm-referral.ts
var POST24 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { ref } = body;
  if (!ref) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 ref token" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const refRecord = await env.DB.prepare(
    `SELECT id, converted_user_id FROM share_referrals WHERE token = ? LIMIT 1`
  ).bind(ref).first();
  if (!refRecord || refRecord.converted_user_id !== null) {
    return new Response(JSON.stringify({ confirmed: false }), {
      headers: { "Content-Type": "application/json" }
    });
  }
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `UPDATE share_referrals SET converted_user_id = ?, converted_at = ? WHERE token = ?`
  ).bind(user.userId, now, ref).run();
  return new Response(JSON.stringify({ confirmed: true }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
var onRequestPost24 = /* @__PURE__ */ __name(async (...args) => {
  return POST24(...args);
}, "onRequestPost");

// api/tier1/referral-status.ts
var GET17 = /* @__PURE__ */ __name(async ({ request, env }, _ctx) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 token \u53C2\u6570" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const row = await env.DB.prepare(
    `SELECT converted_user_id FROM share_referrals WHERE token = ? LIMIT 1`
  ).bind(token).first();
  const converted = row !== null && row.converted_user_id !== null;
  return new Response(
    JSON.stringify({ converted }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "GET");
var onRequestGet17 = /* @__PURE__ */ __name(async (...args) => {
  return GET17(...args);
}, "onRequestGet");

// api/tier1/share.ts
var POST25 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { reportId } = body;
  if (!reportId) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 reportId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const today = beijingDate();
  const MAX_DAILY = 1;
  const usageRow = await env.DB.prepare(
    `SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  ).bind(user.userId, today).first();
  if (usageRow && usageRow.used_count >= MAX_DAILY) {
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "\u4ECA\u65E5\u8FDB\u9636\u62A5\u544A\u6B21\u6570\u5DF2\u7528\u5B8C\uFF0C\u660E\u5929\u518D\u6765\u5427" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  const now = Math.floor(Date.now() / 1e3);
  const token = generateId();
  const shareId = generateId();
  let tier2ReportId = null;
  await env.DB.prepare(
    `INSERT INTO share_referrals (id, token, sharer_user_id, source_report_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(shareId, token, user.userId, reportId, now).run();
  const todayStartUnix = Math.floor(
    (/* @__PURE__ */ new Date(today + "T00:00:00+08:00")).getTime() / 1e3
  );
  const todayEndUnix = todayStartUnix + 24 * 60 * 60;
  const existing = await env.DB.prepare(
    `SELECT 1 FROM reports_tier2 WHERE user_id = ? AND unlock_method = 'share'
     AND created_at >= ? AND created_at < ? LIMIT 1`
  ).bind(user.userId, todayStartUnix, todayEndUnix).first();
  if (!existing) {
    const unlockId = generateId();
    tier2ReportId = unlockId;
    await env.DB.prepare(
      `INSERT INTO reports_tier2
         (id, user_id, source_tier1_report_id, share_token, generation_status, content, unlock_method, created_at)
       VALUES (?, ?, ?, ?, 'processing', '{"status":"processing"}', 'share', ?)`
    ).bind(unlockId, user.userId, reportId, token, now).run();
    context.waitUntil(triggerTier2Generation(reportId, unlockId, env));
  } else {
    const existingRow = await env.DB.prepare(
      `SELECT id, generation_status FROM reports_tier2 WHERE user_id = ? AND source_tier1_report_id = ? AND unlock_method = 'share' ORDER BY created_at DESC LIMIT 1`
    ).bind(user.userId, reportId).first();
    if (existingRow) {
      tier2ReportId = existingRow.id;
      if (existingRow.generation_status === "pending" || existingRow.generation_status === "failed") {
        context.waitUntil(triggerTier2Generation(reportId, existingRow.id, env));
      }
    }
  }
  const baseUrl = env.BASE_URL || "";
  const shareUrl = baseUrl ? `${baseUrl}/capture?ref=${token}` : `/capture?ref=${token}`;
  return new Response(
    JSON.stringify({ token, shareUrl, tier2ReportId }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
async function triggerTier2Generation(tier1ReportId, tier2Id, env) {
  try {
    const tier1Row = await env.DB.prepare(
      `SELECT report_data FROM reports_tier1 WHERE id = ? LIMIT 1`
    ).bind(tier1ReportId).first();
    if (!tier1Row) return;
    const tier1Report = JSON.parse(tier1Row.report_data);
    const tier2Content = await callDeepSeekTier2(tier1Report, env);
    if (tier2Content) {
      const now = Math.floor(Date.now() / 1e3);
      await env.DB.prepare(
        `UPDATE reports_tier2 SET content = ?, generation_status = 'ready', updated_at = ? WHERE id = ?`
      ).bind(JSON.stringify(tier2Content), now, tier2Id).run();
      console.log(`[tier1/share] Generated tier2 for ${tier2Id}`);
    } else {
      const now = Math.floor(Date.now() / 1e3);
      await env.DB.prepare(
        `UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`
      ).bind(now, tier2Id).run();
      console.error(`[tier1/share] Failed to generate tier2 for ${tier2Id}`);
    }
  } catch (e) {
    console.error(`[tier1/share] Exception generating tier2:`, e);
    const now = Math.floor(Date.now() / 1e3);
    await env.DB.prepare(
      `UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`
    ).bind(now, tier2Id).run();
  }
}
__name(triggerTier2Generation, "triggerTier2Generation");
var onRequestPost25 = /* @__PURE__ */ __name(async (...args) => {
  return POST25(...args);
}, "onRequestPost");

// api/tier1/validate.ts
var GET18 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const url = new URL(request.url);
  const reportId = url.searchParams.get("id");
  if (!reportId) {
    return new Response(JSON.stringify({ valid: false }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const row = await env.DB.prepare(
    "SELECT 1 FROM reports_tier1 WHERE id = ? AND user_id = ? LIMIT 1"
  ).bind(reportId, user.userId).first();
  return new Response(
    JSON.stringify({ valid: !!row }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "GET");
var onRequestGet18 = /* @__PURE__ */ __name(async (...args) => {
  return GET18(...args);
}, "onRequestGet");

// api/tier2/generate.ts
var POST26 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { reportId } = body;
  if (!reportId) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 reportId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const tier2Row = await env.DB.prepare(
    `SELECT id, generation_status, content, source_tier1_report_id
     FROM reports_tier2 WHERE id = ? AND user_id = ? LIMIT 1`
  ).bind(reportId, user.userId).first();
  if (!tier2Row) {
    return new Response(JSON.stringify({ error: "\u62A5\u544A\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (tier2Row.generation_status === "ready") {
    try {
      const content = JSON.parse(tier2Row.content);
      return new Response(JSON.stringify({ id: tier2Row.id, content, generationStatus: "ready" }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch {
    }
  }
  if (!tier2Row.source_tier1_report_id) {
    return new Response(
      JSON.stringify({ error: "\u7F3A\u5C11 source_tier1_report_id\uFF0C\u65E0\u6CD5\u751F\u6210\u62A5\u544A" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = ? LIMIT 1`
  ).bind(tier2Row.source_tier1_report_id).first();
  if (!tier1Row) {
    return new Response(
      JSON.stringify({ error: "\u6E90 tier1 \u62A5\u544A\u4E0D\u5B58\u5728" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  let tier1Report;
  try {
    tier1Report = JSON.parse(tier1Row.report_data);
  } catch {
    return new Response(
      JSON.stringify({ error: "tier1 \u62A5\u544A\u6570\u636E\u89E3\u6790\u5931\u8D25" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `UPDATE reports_tier2 SET generation_status = 'processing', updated_at = ? WHERE id = ?`
  ).bind(now, tier2Row.id).run();
  context.waitUntil(generateTier2Async(tier1Report, tier2Row.id, env));
  return new Response(JSON.stringify({ id: tier2Row.id, generationStatus: "processing" }), {
    headers: { "Content-Type": "application/json" }
  });
}, "POST");
async function generateTier2Async(tier1Report, tier2Id, env) {
  try {
    const tier2Content = await callDeepSeekTier2(tier1Report, env);
    if (tier2Content) {
      const now = Math.floor(Date.now() / 1e3);
      await env.DB.prepare(
        `UPDATE reports_tier2 SET content = ?, generation_status = 'ready', updated_at = ? WHERE id = ?`
      ).bind(JSON.stringify(tier2Content), now, tier2Id).run();
      console.log(`[tier2/generate] Successfully generated for ${tier2Id}`);
    } else {
      const now = Math.floor(Date.now() / 1e3);
      await env.DB.prepare(
        `UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`
      ).bind(now, tier2Id).run();
      console.error(`[tier2/generate] Failed to generate for ${tier2Id}`);
    }
  } catch (e) {
    console.error(`[tier2/generate] Async exception for ${tier2Id}:`, e);
    const now = Math.floor(Date.now() / 1e3);
    await env.DB.prepare(
      `UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`
    ).bind(now, tier2Id).run();
  }
}
__name(generateTier2Async, "generateTier2Async");
var onRequestPost26 = /* @__PURE__ */ __name(async (...args) => {
  return POST26(...args);
}, "onRequestPost");

// api/tier2/status.ts
var GET19 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const url = new URL(request.url);
  const tier1ReportId = url.searchParams.get("tier1ReportId");
  const tier2Id = url.searchParams.get("tier2Id");
  if (tier2Id) {
    const row2 = await env.DB.prepare(`SELECT id, generation_status, content, source_tier1_report_id FROM reports_tier2 WHERE id = ? AND user_id = ? LIMIT 1`).bind(tier2Id, user.userId).first();
    if (!row2) {
      return new Response(JSON.stringify({ error: "\u62A5\u544A\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (row2.generation_status === "pending" && row2.content === JSON.stringify({ status: "pending" })) {
      const tier1Row = await env.DB.prepare(`SELECT report_data FROM reports_tier1 WHERE id = (SELECT source_tier1_report_id FROM reports_tier2 WHERE id = ? LIMIT 1)`).bind(row2.id).first();
      if (tier1Row) {
        try {
          const tier1Report = JSON.parse(tier1Row.report_data);
          const now = Math.floor(Date.now() / 1e3);
          await env.DB.prepare(`UPDATE reports_tier2 SET generation_status = 'processing', updated_at = ? WHERE id = ?`).bind(now, row2.id).run();
          context.waitUntil(generateTier2Async2(tier1Report, row2.id, env));
          return new Response(JSON.stringify({ generationStatus: "processing", tier2ReportId: row2.id }), { headers: { "Content-Type": "application/json" } });
        } catch {
        }
      }
    }
    const result = { generationStatus: row2.generation_status, tier2ReportId: row2.id };
    if (row2.generation_status === "ready" && row2.content) {
      try {
        result.content = JSON.parse(row2.content);
      } catch {
        result.content = null;
      }
    }
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  }
  if (!tier1ReportId) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 tier1ReportId \u6216 tier2Id" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const row = await env.DB.prepare(`SELECT id, generation_status, content, source_tier1_report_id FROM reports_tier2 WHERE source_tier1_report_id = ? AND user_id = ? LIMIT 1`).bind(tier1ReportId, user.userId).first();
  if (row) {
    if (row.generation_status === "pending" && row.content === JSON.stringify({ status: "pending" })) {
      const tier1Row = await env.DB.prepare(`SELECT report_data FROM reports_tier1 WHERE id = ?`).bind(row.source_tier1_report_id).first();
      if (tier1Row) {
        try {
          const tier1Report = JSON.parse(tier1Row.report_data);
          const now = Math.floor(Date.now() / 1e3);
          await env.DB.prepare(`UPDATE reports_tier2 SET generation_status = 'processing', updated_at = ? WHERE id = ?`).bind(now, row.id).run();
          context.waitUntil(generateTier2Async2(tier1Report, row.id, env));
          return new Response(JSON.stringify({ generationStatus: "processing", tier2ReportId: row.id }), { headers: { "Content-Type": "application/json" } });
        } catch {
        }
      }
    }
    const result = { generationStatus: row.generation_status, tier2ReportId: row.id };
    if (row.generation_status === "ready" && row.content) {
      try {
        result.content = JSON.parse(row.content);
      } catch {
        result.content = null;
      }
    }
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  }
  return new Response(JSON.stringify({ generationStatus: "not_found" }), { headers: { "Content-Type": "application/json" } });
}, "GET");
var onRequestGet19 = /* @__PURE__ */ __name(async (...args) => {
  return GET19(...args);
}, "onRequestGet");
async function generateTier2Async2(tier1Report, tier2Id, env) {
  try {
    const tier2Content = await callDeepSeekTier2(tier1Report, env);
    const now = Math.floor(Date.now() / 1e3);
    if (tier2Content) {
      await env.DB.prepare(`UPDATE reports_tier2 SET content = ?, generation_status = 'ready', updated_at = ? WHERE id = ?`).bind(JSON.stringify(tier2Content), now, tier2Id).run();
      console.log(`[tier2/status] Auto-triggered generation succeeded for ${tier2Id}`);
    } else {
      await env.DB.prepare(`UPDATE reports_tier2 SET generation_status = 'failed', updated_at = ? WHERE id = ?`).bind(now, tier2Id).run();
      console.error(`[tier2/status] Auto-triggered generation failed for ${tier2Id}`);
    }
  } catch (e) {
    console.error(`[tier2/status] Auto-trigger exception for ${tier2Id}:`, e);
  }
}
__name(generateTier2Async2, "generateTier2Async");

// api/tier2/unlock-by-ad.ts
var POST27 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { tier1ReportId } = body;
  if (!tier1ReportId) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 tier1ReportId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const today = beijingDate();
  const MAX_DAILY = 1;
  const usageRow = await env.DB.prepare(
    `SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  ).bind(user.userId, today).first();
  if (usageRow && usageRow.used_count >= MAX_DAILY) {
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "\u4ECA\u65E5\u8FDB\u9636\u62A5\u544A\u6B21\u6570\u5DF2\u7528\u5B8C\uFF0C\u660E\u5929\u518D\u6765\u5427" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  const existing = await env.DB.prepare(
    `SELECT id FROM reports_tier2 WHERE user_id = ? AND created_at >= ? LIMIT 1`
  ).bind(user.userId, Math.floor((/* @__PURE__ */ new Date(today + "T00:00:00+08:00")).getTime() / 1e3)).first();
  if (existing) {
    return new Response(
      JSON.stringify({ error: "daily_limit_exceeded", message: "\u4ECA\u65E5\u8FDB\u9636\u62A5\u544A\u6B21\u6570\u5DF2\u7528\u5B8C\uFF0C\u660E\u5929\u518D\u6765\u5427" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  const now = Math.floor(Date.now() / 1e3);
  const tier2Id = generateId();
  await env.DB.prepare(
    `INSERT INTO reports_tier2
       (id, user_id, source_tier1_report_id, generation_status, content, unlock_method, created_at)
     VALUES (?, ?, ?, 'pending', '{"status":"pending"}', 'ad', ?)`
  ).bind(tier2Id, user.userId, tier1ReportId, now).run();
  return new Response(
    JSON.stringify({ tier2ReportId: tier2Id, unlocked: true }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
var onRequestPost27 = /* @__PURE__ */ __name(async (...args) => {
  return POST27(...args);
}, "onRequestPost");

// api/tier2/unlock-image.ts
var POST28 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { reportId } = body;
  if (!reportId) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 reportId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const today = beijingDate();
  const tier2Row = await env.DB.prepare(
    `SELECT id, user_id, share_token FROM reports_tier2 WHERE id = ? LIMIT 1`
  ).bind(reportId).first();
  if (!tier2Row || tier2Row.user_id !== user.userId) {
    return new Response(JSON.stringify({ error: "\u62A5\u544A\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (!tier2Row.share_token) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "referral_not_confirmed" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  const referralRow = await env.DB.prepare(
    `SELECT converted_user_id FROM share_referrals WHERE token = ? LIMIT 1`
  ).bind(tier2Row.share_token).first();
  if (!referralRow || !referralRow.converted_user_id) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "referral_not_confirmed" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  const MAX_DAILY_IMAGES = 1;
  const usageRow = await env.DB.prepare(
    `SELECT used_count FROM tier2_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1`
  ).bind(user.userId, today).first();
  if (usageRow && usageRow.used_count >= MAX_DAILY_IMAGES) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "daily_limit_exceeded" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
  let imageDataUrl = null;
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = (SELECT source_tier1_report_id FROM reports_tier2 WHERE id = ?) LIMIT 1`
  ).bind(reportId).first();
  if (tier1Row?.report_data) {
    try {
      const tier1Report = JSON.parse(tier1Row.report_data);
      const facePhotoKey = tier1Report.facePhotoKey;
      if (facePhotoKey) {
        const obj = await env.R2_TEMP.get(facePhotoKey);
        if (obj && "body" in obj) {
          const arrayBuffer = await obj.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64 = btoa(binary);
          const contentType = obj.httpMetadata?.contentType || "image/jpeg";
          imageDataUrl = `data:${contentType};base64,${base64}`;
          imageDataUrl = await resizeBase64IfNeeded(imageDataUrl, 2048);
          console.log(`[tier2/unlock-image] Read R2 image: ${facePhotoKey}, size: ${arrayBuffer.byteLength} bytes`);
        }
      }
    } catch (e) {
      console.error("[tier2/unlock-image] Failed to read R2 image:", e);
    }
  }
  if (!imageDataUrl) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "no_face_photo", message: "\u672A\u627E\u5230\u7528\u6237\u539F\u59CB\u7167\u7247\uFF0C\u8BF7\u91CD\u65B0\u8FDB\u884C\u5206\u6790" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  let styleDesc = "\u6E05\u65B0\u81EA\u7136\u6DE1\u5986";
  try {
    const contentRow = await env.DB.prepare(
      `SELECT content FROM reports_tier2 WHERE id = ? LIMIT 1`
    ).bind(reportId).first();
    if (contentRow?.content) {
      const content = JSON.parse(contentRow.content);
      if (typeof content.style === "string") styleDesc = content.style;
      if (Array.isArray(content.keyAreas) && content.keyAreas.length > 0) {
        styleDesc += "\uFF0C\u91CD\u70B9\uFF1A" + content.keyAreas.slice(0, 3).join("\u3001");
      }
    }
  } catch {
  }
  const generatedImageUrl = await generateImageWithDashScope(imageDataUrl, styleDesc, env);
  if (!generatedImageUrl) {
    return new Response(
      JSON.stringify({ unlocked: false, reason: "ai_generation_failed", retryable: true }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  let imageBuffer;
  try {
    const imgResp = await fetch(generatedImageUrl, {
      signal: AbortSignal.timeout(3e4)
    });
    if (!imgResp.ok) {
      console.error("[tier2/unlock-image] Failed to download generated image:", imgResp.status);
      return new Response(
        JSON.stringify({ unlocked: false, reason: "image_download_failed", retryable: true }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    imageBuffer = await imgResp.arrayBuffer();
  } catch (e) {
    console.error("[tier2/unlock-image] Image download error:", e);
    return new Response(
      JSON.stringify({ unlocked: false, reason: "image_download_failed", retryable: true }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  const r2Key = `tier2-ai/${generateId()}.jpg`;
  console.log(`[tier2/unlock-image] Starting R2 upload, key=${r2Key}, buffer size=${imageBuffer.byteLength} bytes`);
  console.log(`[tier2/unlock-image] R2_TEMP binding type=${typeof env.R2_TEMP}, has put=${typeof env.R2_TEMP?.put}`);
  try {
    const putResult = await env.R2_TEMP.put(r2Key, new Uint8Array(imageBuffer), {
      httpMetadata: { contentType: "image/jpeg" }
      // TODO: ai_image_url 对应的 R2 文件需要当天24点清理（scheduled-worker 会处理）
    });
    console.log(`[tier2/unlock-image] R2 upload completed, result=${JSON.stringify(putResult)}`);
    const verifyObj = await env.R2_TEMP.get(r2Key);
    console.log(`[tier2/unlock-image] Post-upload verification: obj exists=${!!verifyObj}, hasBody=${verifyObj ? "body" in verifyObj : false}`);
    if (verifyObj && "body" in verifyObj) {
      const verifySize = (await verifyObj.arrayBuffer()).byteLength;
      console.log(`[tier2/unlock-image] Verification: read back ${verifySize} bytes`);
    }
  } catch (e) {
    console.error("[tier2/unlock-image] R2 upload failed:", e);
    return new Response(
      JSON.stringify({ unlocked: false, reason: "storage_failed", retryable: true }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const r2Url = `/api/r2-proxy?key=${encodeURIComponent(r2Key)}`;
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `UPDATE reports_tier2 SET ai_image_url = ?, updated_at = ? WHERE id = ?`
  ).bind(r2Url, now, reportId).run();
  if (!usageRow) {
    await env.DB.prepare(
      `INSERT INTO tier2_daily_usage (user_id, usage_date, used_count) VALUES (?, ?, 1)`
    ).bind(user.userId, today).run();
  } else {
    await env.DB.prepare(
      `UPDATE tier2_daily_usage SET used_count = used_count + 1 WHERE user_id = ? AND usage_date = ?`
    ).bind(user.userId, today).run();
  }
  return new Response(
    JSON.stringify({ unlocked: true, imageUrl: r2Url }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
async function generateImageWithDashScope(imageDataUrl, styleDesc, env) {
  const apiKey = env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    console.warn("[tier2/unlock-image] DASHSCOPE_API_KEY not configured");
    return null;
  }
  const prompt = `${styleDesc}\uFF0C\u4E13\u4E1A\u7F8E\u5986\u5986\u5BB9\uFF0C\u7CBE\u81F4\u5E95\u5986\uFF0C\u81EA\u7136\u773C\u5F71\uFF0C\u7EA2\u6DA6\u5507\u8272\uFF0C\u9AD8\u6E05\u5199\u771F\u98CE\u683C\uFF0C\u6B63\u9762\u8138\u90E8\u7279\u5199`;
  const submitResp = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-DashScope-Async": "enable"
      },
      body: JSON.stringify({
        model: "wanx2.1-imageedit",
        input: {
          function: "description_edit",
          prompt,
          base_image_url: imageDataUrl
        },
        parameters: { n: 1 }
      }),
      signal: AbortSignal.timeout(15e3)
    }
  );
  if (!submitResp.ok) {
    const eb = await submitResp.text().catch(() => "");
    console.error(`[tier2/unlock-image] DashScope submit error ${submitResp.status}: ${eb.slice(0, 300)}`);
    return null;
  }
  const submitData = await submitResp.json();
  const taskId = submitData?.output?.task_id;
  if (!taskId) {
    console.error("[tier2/unlock-image] DashScope submit: no task_id in response", JSON.stringify(submitData).slice(0, 200));
    return null;
  }
  const imageUrl = await pollTaskResult(apiKey, taskId);
  if (!imageUrl) {
    console.error(`[tier2/unlock-image] Task ${taskId} timed out or failed`);
  }
  return imageUrl;
}
__name(generateImageWithDashScope, "generateImageWithDashScope");
async function pollTaskResult(apiKey, taskId) {
  const maxAttempts = 30;
  const intervalMs = 3e3;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const resp = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(1e4)
      }
    );
    if (!resp.ok) {
      console.error(`[tier2/unlock-image] Poll error ${resp.status}`);
      continue;
    }
    const data = await resp.json();
    const status = data?.output?.task_status;
    if (status === "SUCCEEDED") {
      const url = data?.output?.results?.[0]?.url;
      if (url) return url;
      console.error("[tier2/unlock-image] Succeeded but no URL in results");
      return null;
    }
    if (status === "FAILED") {
      console.error(`[tier2/unlock-image] Task failed: ${data?.output?.message}`);
      return null;
    }
  }
  console.error("[tier2/unlock-image] Poll timed out after max attempts");
  return null;
}
__name(pollTaskResult, "pollTaskResult");
var onRequestPost28 = /* @__PURE__ */ __name(async (...args) => {
  return POST28(...args);
}, "onRequestPost");

// api/tier3/generate.ts
var POST29 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { tier1ReportId, questionnaireAnswers } = body;
  if (!tier1ReportId) {
    return new Response(
      JSON.stringify({ error: "\u7F3A\u5C11 tier1ReportId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (!questionnaireAnswers || typeof questionnaireAnswers !== "object") {
    return new Response(
      JSON.stringify({ error: "\u7F3A\u5C11 questionnaireAnswers" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const tokenRow = await env.DB.prepare(
    `SELECT id FROM tokens WHERE user_id = ? AND status = 'unused' LIMIT 1`
  ).bind(user.userId).first();
  if (!tokenRow) {
    return new Response(
      JSON.stringify({ error: "no_token" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  const tier1Row = await env.DB.prepare(
    `SELECT report_data FROM reports_tier1 WHERE id = ? AND user_id = ? LIMIT 1`
  ).bind(tier1ReportId, user.userId).first();
  if (!tier1Row) {
    return new Response(
      JSON.stringify({ error: "tier1 \u62A5\u544A\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u8BBF\u95EE" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }
  let tier1Report;
  try {
    tier1Report = JSON.parse(tier1Row.report_data);
  } catch {
    return new Response(
      JSON.stringify({ error: "tier1 \u62A5\u544A\u6570\u636E\u89E3\u6790\u5931\u8D25" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const reportContent = await callDeepSeekTier3(tier1Report, questionnaireAnswers, env);
  if (!reportContent) {
    return new Response(
      JSON.stringify({ error: "\u751F\u6210\u5931\u8D25", retryable: true, message: "AI \u670D\u52A1\u8C03\u7528\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `UPDATE tokens SET status = 'used', used_at = ? WHERE id = ?`
  ).bind(now, tokenRow.id).run();
  const reportId = generateId();
  const expireAt = now + 30 * 24 * 60 * 60;
  const scenario = questionnaireAnswers.scenario ?? "\u65E5\u5E38\u901A\u52E4";
  await env.DB.prepare(
    `INSERT INTO reports_tier3 (id, user_id, token_id, scenario, quiz_answers, content, created_at, expire_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    reportId,
    user.userId,
    tokenRow.id,
    scenario,
    JSON.stringify(questionnaireAnswers),
    JSON.stringify(reportContent),
    now,
    expireAt
  ).run();
  return new Response(
    JSON.stringify({ id: reportId, content: reportContent, expireAt }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
async function callDeepSeekTier3(tier1Report, questionnaireAnswers, env) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn("[tier3/generate] DEEPSEEK_API_KEY not configured");
    return null;
  }
  const style = questionnaireAnswers.makeupStyle ?? "";
  const scenario = questionnaireAnswers.scenario ?? "";
  const skillLevel = questionnaireAnswers.skillLevel ?? "";
  const timeCost = questionnaireAnswers.timeCost ?? "";
  const prompt = `You are a professional beauty consultant. Based on the user's face analysis and their preferences, provide a detailed, personalized makeup guide.

User's Face Analysis Report:
${JSON.stringify(tier1Report, null, 2)}

User's Preferences (from questionnaire):
- \u5986\u5BB9\u98CE\u683C (makeupStyle): ${style}
- \u4F7F\u7528\u573A\u666F (scenario): ${scenario}
- \u719F\u7EC3\u7A0B\u5EA6 (skillLevel): ${skillLevel}
- \u65F6\u95F4\u6210\u672C (timeCost): ${timeCost}

Please output a JSON object with the following structure (strict JSON only, no markdown):
{
  "overallAdvice": "string - one paragraph of overall advice tailored to this style/scenario/skill level/time",
  "stepByStep": [
    {
      "step": "number",
      "title": "string - step title in Chinese",
      "description": "string - detailed instruction tailored to user's skill level and time budget",
      "timeEstimate": "string - e.g. '2\u5206\u949F' or '5\u5206\u949F'",
      "difficultyHint": "string - '\u9002\u5408\u65B0\u624B' or '\u8FDB\u9636\u6280\u5DE7' based on skillLevel"
    }
  ],
  "productRecs": {
    "base": [{"name": "\u4EA7\u54C1\u540D", "reason": "\u7B80\u77ED\u63A8\u8350\u7406\u7531"}],
    "eyes": [{"name": "\u4EA7\u54C1\u540D", "reason": "\u7B80\u77ED\u63A8\u8350\u7406\u7531"}],
    "lips": [{"name": "\u4EA7\u54C1\u540D", "reason": "\u7B80\u77ED\u63A8\u8350\u7406\u7531"}],
    "cheeks": [{"name": "\u4EA7\u54C1\u540D", "reason": "\u7B80\u77ED\u63A8\u8350\u7406\u7531"}]
  },
  "tips": ["string - 3-5 personalized tips based on the user's features and preferences"],
  "timeWarning": "string - reminder about time budget given the selected timeCost",
  "styleNote": "string - how the ${style} style should be adapted for ${scenario} scenario"
}

Guidelines:
- Make every piece of advice specific to the user's face features from the report
- Adapt difficulty based on skillLevel (\u65B0\u624B=\u7B80\u5355\u6B65\u9AA4, \u719F\u7EC3\u8FDB\u9636=\u4E13\u4E1A\u6280\u5DE7)
- Keep step count reasonable for timeCost (5\u5206\u949F\u6781\u7B80=3-4\u6B65, 30\u5206\u949F\u4EE5\u4E0A\u7CBE\u81F4=6-8\u6B65)
- All text in Chinese except JSON keys
- Be concrete: mention specific techniques, product types, and application methods`;
  try {
    const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
        temperature: 0.6
      }),
      signal: AbortSignal.timeout(45e3)
    });
    if (!resp.ok) {
      const eb = await resp.text().catch(() => "");
      console.error(`[tier3/generate] DeepSeek error ${resp.status}: ${eb.slice(0, 200)}`);
      return null;
    }
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      console.error("[tier3/generate] DeepSeek empty response");
      return null;
    }
    const report = parseDeepseekJson(raw);
    return report;
  } catch (e) {
    console.error("[tier3/generate] DeepSeek exception:", e);
    return null;
  }
}
__name(callDeepSeekTier3, "callDeepSeekTier3");
var onRequestPost29 = /* @__PURE__ */ __name(async (...args) => {
  return POST29(...args);
}, "onRequestPost");

// api/tier3/questionnaire-options.ts
var GET20 = /* @__PURE__ */ __name(async (context) => {
  const { env } = context;
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS questionnaire_options (
      dimension TEXT PRIMARY KEY,
      options TEXT NOT NULL,
      updated_at INTEGER
    )
  `).run();
  const rows = await env.DB.prepare(
    "SELECT dimension, options, updated_at FROM questionnaire_options ORDER BY dimension"
  ).all();
  const optionsMap = {};
  for (const row of rows.results ?? []) {
    try {
      optionsMap[row.dimension] = JSON.parse(row.options);
    } catch {
      optionsMap[row.dimension] = [];
    }
  }
  return new Response(JSON.stringify({ options: optionsMap }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var onRequestGet20 = GET20;

// api/tier3/redeem.ts
var POST30 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const body = await request.json();
  const { code } = body;
  if (!code) {
    return new Response(JSON.stringify({ error: "invalid_code", message: "\u8BF7\u8F93\u5165\u5151\u6362\u7801" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const tokenRow = await env.DB.prepare(
    `SELECT id, user_id FROM tokens WHERE redeem_code = ? AND status = 'unused' LIMIT 1`
  ).bind(code.trim().toUpperCase()).first();
  if (!tokenRow) {
    return new Response(
      JSON.stringify({ error: "invalid_code", message: "\u5151\u6362\u7801\u65E0\u6548\u6216\u5DF2\u88AB\u4F7F\u7528" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  if (tokenRow.user_id !== null) {
    return new Response(
      JSON.stringify({ error: "invalid_code", message: "\u5151\u6362\u7801\u65E0\u6548\u6216\u5DF2\u88AB\u4F7F\u7528" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  await env.DB.prepare(
    `UPDATE tokens SET user_id = ? WHERE id = ?`
  ).bind(user.userId, tokenRow.id).run();
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "POST");
var onRequestPost30 = /* @__PURE__ */ __name(async (...args) => {
  return POST30(...args);
}, "onRequestPost");

// api/tier3/token-status.ts
var GET21 = /* @__PURE__ */ __name(async (context) => {
  const { request, env } = context;
  const user = await requireAuth(request, env);
  if (!user) {
    return new Response(JSON.stringify({ error: "\u672A\u767B\u5F55" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as cnt FROM tokens WHERE user_id = ? AND status = 'unused'`
  ).bind(user.userId).first();
  const count = row?.cnt ?? 0;
  return new Response(
    JSON.stringify({ hasToken: count > 0, count }),
    { headers: { "Content-Type": "application/json" } }
  );
}, "GET");
var onRequestGet21 = GET21;

// api/config/[key].ts
var GET22 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const key = params?.key;
  if (!key) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 key \u53C2\u6570" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER
    )
  `).run();
  const now = Math.floor(Date.now() / 1e3);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('influencer_apply_message', '\u7533\u8BF7\u5DF2\u63D0\u4EA4\uFF0C\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u8054\u7CFB\u4F60\uFF5E', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('influencer_contact_info', '', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('sms_login_enabled', 'false', ?)`
  ).bind(now).run();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at) VALUES ('tier2_btn_color', '#db2777', ?)`
  ).bind(now).run();
  const row = await env.DB.prepare(
    "SELECT key, value, updated_at FROM app_config WHERE key = ? LIMIT 1"
  ).bind(key).first();
  if (!row) {
    return new Response(JSON.stringify({ error: "\u914D\u7F6E\u9879\u4E0D\u5B58\u5728" }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ key: row.key, value: row.value, updated_at: row.updated_at }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var onRequestGet22 = /* @__PURE__ */ __name(async (...args) => {
  return GET22(...args);
}, "onRequestGet");

// api/r2-perm/[key].ts
var GET23 = /* @__PURE__ */ __name(async (context) => {
  const { env, params } = context;
  const key = params?.key;
  if (!key) {
    return new Response(JSON.stringify({ error: "\u7F3A\u5C11 key \u53C2\u6570" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  try {
    const obj = await env.R2_PERM.get(key);
    if (!obj) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
    let body;
    if ("arrayBuffer" in obj && typeof obj.arrayBuffer === "function") {
      body = new Uint8Array(await obj.arrayBuffer());
    } else {
      return new Response(JSON.stringify({ error: "cannot read body" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=86400"
      }
    });
  } catch (e) {
    console.error("[r2-perm-proxy] Error:", e);
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}, "GET");
var onRequestGet23 = /* @__PURE__ */ __name(async (...args) => {
  return GET23(...args);
}, "onRequestGet");

// api/test-route/[param].ts
var GET24 = /* @__PURE__ */ __name(async (context) => {
  const { params } = context;
  const p = params?.param;
  return new Response(JSON.stringify({ received: p, ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}, "GET");
var onRequestGet24 = /* @__PURE__ */ __name(async (...args) => {
  return GET24(...args);
}, "onRequestGet");

// api/r2-proxy.ts
var GET25 = /* @__PURE__ */ __name(async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const bucketParam = url.searchParams.get("bucket") || "temp";
  if (!key) {
    return new Response(JSON.stringify({ error: "missing key parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  const bucket = bucketParam === "perm" ? env.R2_PERM : env.R2_TEMP;
  try {
    const obj = await bucket.get(key);
    if (!obj) {
      return new Response(JSON.stringify({ error: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
    let body;
    if ("arrayBuffer" in obj && typeof obj.arrayBuffer === "function") {
      body = new Uint8Array(await obj.arrayBuffer());
    } else {
      return new Response(JSON.stringify({ error: "cannot read body" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (e) {
    console.error("[r2-proxy] Error:", e);
    return new Response(JSON.stringify({ error: "internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}, "GET");
var onRequestGet25 = /* @__PURE__ */ __name(async (...args) => GET25(...args), "onRequestGet");

// ../.wrangler/tmp/pages-qJs3LX/functionsRoutes-0.05052763325796783.mjs
var routes = [
  {
    routePath: "/api/admin/influencers/:id/approve",
    mountPath: "/api/admin/influencers/:id",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/influencers/:id/reject",
    mountPath: "/api/admin/influencers/:id",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/phone/login",
    mountPath: "/api/auth/phone",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/auth/phone/login-password",
    mountPath: "/api/auth/phone",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/auth/phone/send-code",
    mountPath: "/api/auth/phone",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/auth/wechat/login",
    mountPath: "/api/auth/wechat",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/orders/callback/alipay",
    mountPath: "/api/orders/callback",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/orders/callback/wechat",
    mountPath: "/api/orders/callback",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/admin/config",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/config",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/admin/influencers",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/admin/login",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/api/admin/questionnaire-options",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/admin/questionnaire-options",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost11]
  },
  {
    routePath: "/api/auth/auto-login",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost12]
  },
  {
    routePath: "/api/auth/login-or-register",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost13]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost14]
  },
  {
    routePath: "/api/auth/register",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost15]
  },
  {
    routePath: "/api/auth/set-password",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost16]
  },
  {
    routePath: "/api/debug/crypto-test",
    mountPath: "/api/debug",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/debug/env-dump",
    mountPath: "/api/debug",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/debug/jwt-selftest",
    mountPath: "/api/debug",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost17]
  },
  {
    routePath: "/api/debug/jwt-test",
    mountPath: "/api/debug",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/debug/jwt-verify-test",
    mountPath: "/api/debug",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost18]
  },
  {
    routePath: "/api/debug/sms-code",
    mountPath: "/api/debug",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/debug/taobao-test",
    mountPath: "/api/debug",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/api/influencers/apply",
    mountPath: "/api/influencers",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost19]
  },
  {
    routePath: "/api/influencers/match",
    mountPath: "/api/influencers",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet10]
  },
  {
    routePath: "/api/influencers/mine",
    mountPath: "/api/influencers",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet11]
  },
  {
    routePath: "/api/orders/create",
    mountPath: "/api/orders",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost20]
  },
  {
    routePath: "/api/orders/mock-pay-confirm",
    mountPath: "/api/orders",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost21]
  },
  {
    routePath: "/api/reports/mine",
    mountPath: "/api/reports",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet12]
  },
  {
    routePath: "/api/test/get-test",
    mountPath: "/api/test",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet13]
  },
  {
    routePath: "/api/test/md5-test",
    mountPath: "/api/test",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet14]
  },
  {
    routePath: "/api/test/r2-check",
    mountPath: "/api/test",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet15]
  },
  {
    routePath: "/api/test/tb-debug",
    mountPath: "/api/test",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet16]
  },
  {
    routePath: "/api/test/unlock-debug",
    mountPath: "/api/test",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost22]
  },
  {
    routePath: "/api/tier1/analyze",
    mountPath: "/api/tier1",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost23]
  },
  {
    routePath: "/api/tier1/confirm-referral",
    mountPath: "/api/tier1",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost24]
  },
  {
    routePath: "/api/tier1/referral-status",
    mountPath: "/api/tier1",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet17]
  },
  {
    routePath: "/api/tier1/share",
    mountPath: "/api/tier1",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost25]
  },
  {
    routePath: "/api/tier1/validate",
    mountPath: "/api/tier1",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet18]
  },
  {
    routePath: "/api/tier2/generate",
    mountPath: "/api/tier2",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost26]
  },
  {
    routePath: "/api/tier2/status",
    mountPath: "/api/tier2",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet19]
  },
  {
    routePath: "/api/tier2/unlock-by-ad",
    mountPath: "/api/tier2",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost27]
  },
  {
    routePath: "/api/tier2/unlock-image",
    mountPath: "/api/tier2",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost28]
  },
  {
    routePath: "/api/tier3/generate",
    mountPath: "/api/tier3",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost29]
  },
  {
    routePath: "/api/tier3/questionnaire-options",
    mountPath: "/api/tier3",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet20]
  },
  {
    routePath: "/api/tier3/redeem",
    mountPath: "/api/tier3",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost30]
  },
  {
    routePath: "/api/tier3/token-status",
    mountPath: "/api/tier3",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet21]
  },
  {
    routePath: "/api/config/:key",
    mountPath: "/api/config",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet22]
  },
  {
    routePath: "/api/r2-perm/:key",
    mountPath: "/api/r2-perm",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet23]
  },
  {
    routePath: "/api/test-route/:param",
    mountPath: "/api/test-route",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet24]
  },
  {
    routePath: "/api/r2-proxy",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet25]
  }
];

// ../../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
