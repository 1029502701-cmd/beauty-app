/**
 * Taobao affiliate (AliMama) product search module
 * Uses taobao.tbk.dg.material.optional.upgrade API
 */

import type { Ctx } from "./_utils";

export interface TaobaoProduct {
  itemId: string;
  title: string;
  imageUrl: string;
  price: number;
  itemUrl: string;
  shopTitle?: string;
  brandName?: string;
}

export interface CuratedProduct {
  name: string;
  price: number;
  imageUrl: string;
  itemUrl: string;
  shopTitle?: string;
  tags?: string[];
  keywords?: string[];
}

const CACHE_TTL = 24 * 60 * 60;
const MIN_PRICE = 50;
const MAX_PRICE = 2000;

const CATEGORY_PRICE_RANGES: Record<string, [number, number]> = {
  "口红": [20, 150], "唇釉": [20, 150], "唇彩": [20, 150], "唇膏": [20, 150],
  "眼影": [20, 150], "眼影盘": [20, 150],
  "高光": [20, 150],
  "修容": [20, 150], "修容棒": [20, 150], "修容盘": [20, 150], "阴影": [20, 150],
  "眉笔": [20, 150], "眉粉": [20, 150], "眉毛膏": [20, 150], "眉胶": [20, 150],
  "眼线": [20, 150], "眼线笔": [20, 150], "眼线液": [20, 150], "眼线膏": [20, 150],
  "腮红": [20, 150],
  "粉底液": [30, 200], "粉底": [30, 200], "气垫": [30, 200], "气垫BB": [30, 200], "气垫CC": [30, 200],
  "粉饼": [30, 200], "散粉": [30, 200], "定妆": [30, 200], "遮瑕": [30, 200], "遮瑕膏": [30, 200],
  "妆前乳": [30, 200], "隔离": [30, 200],
  "面霜": [30, 250], "乳液": [30, 250], "爽肤水": [30, 250], "化妆水": [30, 250],
  "精华水": [30, 250], "保湿乳": [30, 250], "保湿霜": [30, 250],
  "洁面": [30, 250], "洗面奶": [30, 250], "卸妆": [30, 250], "卸妆水": [30, 250], "卸妆油": [30, 250],
  "防晒": [30, 250], "防晒霜": [30, 250],
  "精华": [50, 350], "精华液": [50, 350], "原液": [50, 350],
  "眼霜": [50, 350], "眼部精华": [50, 350], "眼胶": [50, 350],
  "安瓶": [50, 350], "肌底液": [50, 350],
  "睫毛膏": [20, 150], "睫毛": [20, 150],
};

async function md5FromString(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function buildSign(appSecret, params) {
  var sortedKeys = Object.keys(params).sort();
  var preSign = appSecret;
  for (var i = 0; i < sortedKeys.length; i++) preSign += sortedKeys[i] + params[sortedKeys[i]];
  preSign += appSecret;
  return (await md5FromString(preSign)).toUpperCase();
}

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
    var match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      var itemXml = match[1];
      var numIid = match[2];
      var zkFinalPrice = match[3];
      var clickUrl = match[4];
      var getText = function(tag) {
        var t = "<" + tag + ">";
        var e = "</" + tag + ">";
        var si = itemXml.indexOf(t);
        if (si === -1) return "";
        var se = itemXml.indexOf(e, si + t.length);
        if (se === -1) return "";
        return itemXml.substring(si + t.length, se);
      };
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
      var fullUrl = clickUrl ? (clickUrl.startsWith("http") ? clickUrl : "https:" + clickUrl) : "";
      if (!numIid && !title) continue;
      products.push({
        itemId: numIid, title: title, imageUrl: imageUrl,
        price: isNaN(parseFloat(zkFinalPrice || "0")) ? 0 : parseFloat(zkFinalPrice || "0"),
        itemUrl: fullUrl, shopTitle: shopTitle || undefined, brandName: brandName || undefined,
      });
    }
    return products;
  } catch (e) { console.error("[taobao] XML parse error:", e); return []; }
}

const BRAND_CATEGORY_MAP = {
  "fenty": ["修容棒", "粉底液", "高光", "腮红"],
  "charlotte tilbury": ["眼影盘", "散粉", "粉底", "口红"],
  "clinique": ["保湿乳", "面霜", "精华", "洁面"],
  "la roche-posay": ["保湿乳", "精华", "洁面", "防晒"],
  "urban decay": ["眼影盘", "定妆喷雾", "眼线"],
  "heroine make": ["眼线液", "眼线笔", "眉毛膏"],
  "mac": ["修容盘", "口红", "粉底", "腮红"],
  "dior": ["高光", "口红", "粉底", "散粉"],
  "nars": ["遮瑕膏", "腮红", "口红", "散粉"],
  "benefit": ["眉毛膏", "眉笔", "妆前乳", "散粉"],
  "tarte": ["遮瑕膏", "腮红", "粉底"],
  "anastasia": ["眉笔", "眉粉", "眉毛膏"],
  "sk-ii": ["神仙水", "护肤精华", "面霜"],
  "maybelline": ["睫毛膏", "粉底液", "口红", "眉笔"],
  "shiseido": ["粉底液", "精华", "面霜", "防晒"],
  "larocheposay": ["保湿乳", "精华", "洁面", "防晒"],
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

export function detectCategory(productName: string): string | null {
  if (!productName) return null;
  var name = productName.trim();
  for (var cat of Object.keys(CATEGORY_PRICE_RANGES)) {
    if (name.includes(cat)) return cat;
  }
  var nameLower = name.toLowerCase();
  var enKeywordMap: Record<string, string> = {
    "contour": "修容", "contouring": "修容", "bronzer": "修容",
    "blush": "腮红",
    "eyeshadow": "眼影", "shadow palette": "眼影盘",
    "highlight": "高光", "highlighter": "高光",
    "brow": "眉笔", "eyebrow": "眉笔", "brow pencil": "眉笔", "brow powder": "眉粉", "brow gel": "眉毛膏",
    "eyeliner": "眼线", "liner": "眼线",
    "mascara": "睫毛膏", "lash": "睫毛膏",
    "foundation": "粉底液", "base": "粉底液",
    "primer": "妆前乳", "setting spray": "定妆", "settingpowder": "散粉", "powder": "散粉",
    "concealer": "遮瑕",
    "serum": "精华", "moisturizer": "面霜", "cream": "面霜", "lotion": "乳液",
    "cleanser": "洁面", "face wash": "洁面",
    "sunscreen": "防晒", "spf": "防晒",
    "lip": "口红", "lipstick": "口红", "lip gloss": "唇釉",
    "eye cream": "眼霜", "eye serum": "眼部精华",
  };
  for (var enKey of Object.keys(enKeywordMap)) {
    if (nameLower.includes(enKey.toLowerCase())) {
      return enKeywordMap[enKey];
    }
  }
  return null;
}

export function getPriceRangeForCategory(category: string | null): [number, number] | null {
  if (!category) return null;
  return CATEGORY_PRICE_RANGES[category] || null;
}

const SAMPLE_KEYWORDS = ["小样", "试用装", "中样", "体验装", "1ml", "2ml", "3ml", "5ml", "10ml", "0.5ml", "1.5ml", "30ml*3", "3支装", "5支装", "支装", "分装"];

function isSampleProduct(title: string): boolean {
  return SAMPLE_KEYWORDS.some(function(s) { return title.indexOf(s) !== -1; });
}

let _curatedCache = null;

export async function loadCuratedProducts() {
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

export async function findCuratedProduct(productName, env) {
  var name = productName.trim().toLowerCase();
  var products = await loadCuratedProducts();
  // Semantic category hints: map product name patterns to curated product categories
  var semanticHints = {
    "primer": ["隔离", "妆前乳", "primer"],
    "foundation": ["粉底", "foundation"],
    "moisturiz": ["保湿", "面霜", "精华", "moisturizer", "cream", "serum"],
    "serum": ["精华", "serum", "肌底液"],
    "eyeshadow": ["眼影", "eyeshadow"],
    "mascara": ["睫毛膏", "mascara"],
    "eyeliner": ["眼线", "eyeliner"],
    "brow": ["眉笔", "眉毛", "brow"],
    "blush": ["腮红", "blush"],
    "concealer": ["遮瑕", "concealer"],
    "powder": ["散粉", "定妆", "powder"],
    "lip": ["口红", "唇釉", "lip"],
    "sunscreen": ["防晒", "sunscreen"],
    "cleanser": ["洁面", "cleanser"],
  };
  for (var i = 0; i < products.length; i++) {
    var cp = products[i];
    var tagMatch = cp.tags && cp.tags.some(function(t) { return name.includes(t.toLowerCase()); });
    var kwMatch = cp.keywords && cp.keywords.some(function(k) { return name.includes(k.toLowerCase()) || k.toLowerCase().includes(name); });
    if (tagMatch || kwMatch) {
      console.log("[curated] Matched: " + cp.name + " for " + productName);
      return cp;
    }
    // Semantic hint matching: if product name matches a hint category, try matching curated tags
    for (var hintKey of Object.keys(semanticHints)) {
      if (name.includes(hintKey)) {
        var hints = semanticHints[hintKey];
        var hintMatch = cp.tags && cp.tags.some(function(t) { return hints.some(function(h) { return t.toLowerCase() === h.toLowerCase(); }); });
        if (hintMatch) {
          console.log("[curated] Semantic Matched: " + cp.name + " for " + productName + " (hint=" + hintKey + ")");
          return cp;
        }
      }
    }
  }
  return null;
}

export async function findProductByKeyword(productName: string, env: Ctx["env"]): Promise<TaobaoProduct | null> {
  if (!productName || productName.trim().length < 2) return null;
  var name = productName.trim();
  var category = detectCategory(name);
  var priceRange = getPriceRangeForCategory(category);
  var fallbackSteps = priceRange
    ? [priceRange[0], Math.floor(priceRange[0] * 0.5), Math.floor(priceRange[0] * 0.2), 1]
    : [MIN_PRICE, Math.floor(MIN_PRICE * 0.5), 1];
  var maxPrice = priceRange ? priceRange[1] : MAX_PRICE;

  // Step 1: 先用完整英文名搜索
  var products = await searchTaobaoProducts(name, env, 10);
  if (products.length === 0) {
    // Step 2: 检测品牌，优先用 品牌+中文品类 搜索
    var brand = extractBrand(name);
    var catKeywords = BRAND_CATEGORY_MAP[brand] || [];

    // 优先尝试：brand + detected category（或品牌映射的第一个品类）
    var searchCandidates = [];
    if (category) {
      searchCandidates.push(brand ? brand + " " + category : category);
    }
    // 再添加品牌映射中的品类词
    for (var ci = 0; ci < catKeywords.length; ci++) {
      searchCandidates.push(brand + " " + catKeywords[ci]);
    }
    // 最后兜底：只搜品牌名
    searchCandidates.push(brand || name);

    for (var si = 0; si < searchCandidates.length; si++) {
      var kw = searchCandidates[si];
      products = await searchTaobaoProducts(kw, env, 10);
      if (products.length > 0) {
        console.log("[taobao] Fallback keyword: \"" + kw + "\" -> " + products.length + " results");
        break;
      }
    }
  }
  if (products.length === 0) {
    console.log("[taobao] No search results for: " + name);
    return null;
  }

  // 相关性过滤：优先匹配品牌名，其次匹配首词
  var relevant = products.filter(function(p) {
    var brandKey = extractBrand(name);
    var firstToken = name.split(/[\s\/]+/)[0].toLowerCase();
    var isMatch =
      p.title.includes(name) ||
      (brandKey && p.title.toLowerCase().includes(brandKey)) ||
      p.title.toLowerCase().includes(firstToken);
    if (!isMatch) return false;
    if (isSampleProduct(p.title)) return false;
    return true;
  });

  if (relevant.length === 0) {
    // 放宽过滤：只要包含品牌名且不是小样即可
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
    var candidates = relevant.filter(function(p) { return p.price >= floor && p.price <= maxPrice; });
    if (candidates.length > 0) {
      candidates.sort(function(a, b) { return a.price - b.price; });
      var best = candidates[0];
      var tag = fi === 0 ? "exact" : "fallback floor=¥" + floor;
      console.log("[taobao] Selected (" + tag + "): " + best.title.substring(0, 40) + " (¥" + best.price + ")");
      return best;
    }
    if (fi < fallbackSteps.length - 1) {
      console.log("[taobao] No match at floor ¥" + floor + ", trying next fallback...");
    }
  }

  console.log("[taobao] No valid match for: " + name + " (category=" + category + ")");
  return null;
}

export async function searchTaobaoProducts(keyword, env, limit = 10) {
  var appKey = env.TAOBAO_APP_KEY;
  var appSecret = env.TAOBAO_APP_SECRET;
  var pid = env.TAOBAO_PID || "";
  var adzoneMatch = pid.match(/_(\d+)$/);
  var adzoneId = adzoneMatch ? adzoneMatch[1] : "";
  if (!appKey || !appSecret) { console.warn("[taobao] TAOBAO_APP_KEY or TAOBAO_APP_SECRET not configured"); return []; }
  var cacheKey = "tb:" + keyword.substring(0, 50);
  try {
    var cached = await env.SESSION_KV.get(cacheKey, "json");
    if (cached) { console.log("[taobao] Cache hit for " + keyword); return cached; }
  } catch (e) { console.warn("[taobao] Cache read error:", e); }
  try {
    var timestamp = String(Math.floor(Date.now() / 1000));
    var params = {
      app_key: appKey,
      method: "taobao.tbk.dg.material.optional.upgrade",
      timestamp: timestamp,
      v: "2.0",
      sign_method: "md5",
      q: keyword,
      page_no: "1",
      page_size: String(limit),
      fields: "num_iid,title,pict_url,small_images,resale_price,final_promotion_price,item_url,shop_title,seller_nick,coupon_info,click_url,short_title,brand_name,volume,user_type,zk_final_price",
    };
    if (adzoneId) params.adzone_id = adzoneId;
    var sign = await buildSign(appSecret, params);
    var url = new URL("https://eco.taobao.com/router/rest");
    Object.entries(params).forEach(function(e) { url.searchParams.set(e[0], e[1]); });
    url.searchParams.set("sign", sign);
    console.log("[taobao] Fetching " + keyword + " -> " + url.toString().slice(0, 120));
    var resp = await fetch(url.toString(), { headers: { "User-Agent": "BeautyApp/1.0" }, signal: AbortSignal.timeout(15000) });
    if (!resp.ok) { console.error("[taobao] API HTTP error " + resp.status); return []; }
    var xmlText = await resp.text();
    var products = parseTaobaoXml(xmlText);
    if (products.length > 0) {
      try { await env.SESSION_KV.put(cacheKey, JSON.stringify(products), { expirationTtl: CACHE_TTL }); console.log("[taobao] Cached " + products.length + " for " + keyword); }
      catch (e) { console.warn("[taobao] Cache write error:", e); }
    }
    return products;
  } catch (e) { console.error("[taobao] Search error for " + keyword + ":", e); return []; }
}

